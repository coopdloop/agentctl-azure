"""Seed a Foundry project with agents on the current *agents* API (what the new Foundry portal
shows) and traced conversations via the Responses API.

Each agent version automatically gets an Entra Agent ID instance identity.

  python seed_agents_v2.py --endpoint <project endpoint> --appinsights "<connection string>"

Auth: AzureCliCredential (`az login`). Prompt/response content is NOT recorded in traces.
"""

from __future__ import annotations

import argparse
import contextvars
import json
import os
import random
import time

os.environ.setdefault("AZURE_TRACING_GEN_AI_CONTENT_RECORDING_ENABLED", "false")
os.environ.setdefault("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", "false")

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import CodeInterpreterTool, FunctionTool, PromptAgentDefinition
from azure.ai.projects.telemetry import AIProjectInstrumentor
from azure.core.settings import settings
from azure.identity import AzureCliCredential
from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry import trace
from opentelemetry.sdk.trace import SpanProcessor

from seed_agents import MANDATORY, create_ticket, get_ticket, lookup_leave_policy  # reuse harness text + tools

current_user: contextvars.ContextVar[str | None] = contextvars.ContextVar("user", default=None)
current_flow: contextvars.ContextVar[str | None] = contextvars.ContextVar("flow", default=None)
current_agent: contextvars.ContextVar[str | None] = contextvars.ContextVar("agent", default=None)


class AttributionProcessor(SpanProcessor):
    """Stamps end user, auth flow and agent name on every span (the agent name is not always
    emitted by the SDK on Responses calls)."""

    def on_start(self, span, parent_context=None):
        if (u := current_user.get()) is not None:
            span.set_attribute("enduser.id", u)
        if (f := current_flow.get()) is not None:
            span.set_attribute("agentctl.auth_flow", f)
        if (a := current_agent.get()) is not None:
            span.set_attribute("gen_ai.agent.name", a)


def fn_tool(f, params: dict) -> FunctionTool:
    doc = (f.__doc__ or "").strip().splitlines()[0]
    return FunctionTool(name=f.__name__, description=doc, parameters={"type": "object", "properties": params, "required": list(params), "additionalProperties": False}, strict=True)


FUNCS = {"get_ticket": get_ticket, "create_ticket": create_ticket, "lookup_leave_policy": lookup_leave_policy}

AGENTS = [
    {
        "name": "it-helpdesk",
        "description": "Tier-1 IT helpdesk: troubleshooting and ticket creation.",
        "instructions": f"{MANDATORY}\n\nYou are the IT helpdesk agent. Use get_ticket to look up tickets and create_ticket when an issue cannot be resolved. Keep answers short.",
        "tools": [
            fn_tool(get_ticket, {"ticket_id": {"type": "string"}}),
            fn_tool(create_ticket, {"summary": {"type": "string"}, "severity": {"type": "string", "enum": ["low", "medium", "high"]}}),
        ],
        "metadata": {"agentctl.owners": "owner@contoso.example", "agentctl.team": "End User Computing", "agentctl.environment": "prod", "agentctl.classification": "internal"},
        "prompts": ["Is there a ticket for INC1001?", "Open a ticket: monitor flickers, low severity", "How do I map a network drive?"],
        "flow": "delegated",
    },
    {
        # Missing the mandatory harness on purpose → agentctl finding + Fix flow.
        "name": "hr-benefits",
        "description": "Answers employee questions about leave and benefits.",
        "instructions": "You are the HR benefits assistant. Answer leave questions using lookup_leave_policy. Never give legal or tax advice.",
        "tools": [fn_tool(lookup_leave_policy, {"topic": {"type": "string"}})],
        "metadata": {"agentctl.owners": "owner@contoso.example", "agentctl.team": "People Systems", "agentctl.environment": "prod", "agentctl.classification": "confidential"},
        "prompts": ["How much parental leave do I get?", "What's the sick leave policy?"],
        "flow": "obo",
    },
    {
        "name": "finance-report",
        "description": "Computes finance figures on a schedule (app-only).",
        "instructions": f"{MANDATORY}\n\nYou compute simple finance figures with code interpreter and reply with the number only.",
        "tools": [CodeInterpreterTool(container={"type": "auto"})],
        "metadata": {"agentctl.owners": "owner@contoso.example", "agentctl.team": "Finance Ops", "agentctl.environment": "prod", "agentctl.classification": "highly_confidential"},
        "prompts": ["Compound 10000 at 5% for 7 years.", "Average of 1200, 980, 1430, 1105?"],
        "flow": "agent_identity",
    },
]

USERS = ["owner@contoso.example", "alex@contoso.example", "sam@contoso.example"]


def converse(openai, agent_name: str, prompt: str) -> str:
    ref = {"agent_reference": {"name": agent_name, "type": "agent_reference"}}
    resp = openai.responses.create(input=prompt, extra_body=ref)
    for _ in range(5):  # client-side function-call loop
        calls = [o for o in resp.output if o.type == "function_call"]
        if not calls:
            break
        outputs = []
        for c in calls:
            result = FUNCS[c.name](**json.loads(c.arguments or "{}"))
            outputs.append({"type": "function_call_output", "call_id": c.call_id, "output": result})
        resp = openai.responses.create(input=outputs, previous_response_id=resp.id, extra_body=ref)
    return resp.status


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--endpoint", required=True)
    ap.add_argument("--appinsights", required=True)
    ap.add_argument("--model", default="gpt-4.1")
    ap.add_argument("--rounds", type=int, default=2)
    args = ap.parse_args()

    settings.tracing_implementation = "opentelemetry"
    configure_azure_monitor(connection_string=args.appinsights)
    trace.get_tracer_provider().add_span_processor(AttributionProcessor())
    AIProjectInstrumentor().instrument()

    project = AIProjectClient(endpoint=args.endpoint, credential=AzureCliCredential())
    openai = project.get_openai_client()

    for spec in AGENTS:
        v = project.agents.create_version(
            agent_name=spec["name"],
            definition=PromptAgentDefinition(model=args.model, instructions=spec["instructions"], tools=spec["tools"], temperature=0.2),
            metadata=spec["metadata"],
            description=spec["description"],
        )
        print(f"{spec['name']}: version {v.version} (identity {getattr(v, 'instance_identity', None) and v.instance_identity.principal_id})")
        for _ in range(args.rounds):
            for prompt in spec["prompts"]:
                user = None if spec["flow"] == "agent_identity" else random.choice(USERS)
                toks = (current_user.set(user), current_flow.set(spec["flow"]), current_agent.set(spec["name"]))
                try:
                    status = converse(openai, spec["name"], prompt)
                    print(f"  {status} ({user or 'app-only'})")
                finally:
                    current_user.reset(toks[0])
                    current_flow.reset(toks[1])
                    current_agent.reset(toks[2])

    print("flushing telemetry…")
    trace.get_tracer_provider().force_flush()
    time.sleep(5)


if __name__ == "__main__":
    main()
