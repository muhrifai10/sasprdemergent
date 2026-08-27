import asyncio
import json

import server


async def gen(project_id):
    project = await server.db.projects.find_one({"id": project_id}, {"_id": 0})
    provider, model, api_key, base_url = (await server.build_ai_attempts())[0]
    chunks = []
    async for chunk in server.stream_prd(
        provider, api_key, base_url, model, project, "id", server.PRD_SYSTEM,
        server.prd_user_prompt(project, "id"),
    ):
        chunks.append(chunk)
    content = "\n\n".join(chunks)
    server.validate_prd_consistency(content)
    content = server.strip_prd_contract_markers(content)
    report = server.analyze_prd_consistency(content)
    return project["name"], provider, model, report, content


async def main():
    for pid in ("4c074d6d-7ebb-438a-8a7d-92cb1b59fd92", "test-attendance-0001", "test-saas-0002"):
        name, provider, model, report, content = await gen(pid)
        low = content.lower()
        leak = {"midtrans": "Midtrans" in low, "stripe": "Stripe" in low,
                "absensi" if True else "x": ("check-in" in low or "kehadiran" in low or "karyawan" in low)}
        print(f"== {name} == counts={json.dumps(report['counts'])} ready={report['readiness']} provider={provider}/{model}")
        print(f"   critical={json.dumps(report['critical'])}")
        print(f"   high={json.dumps(report['high'])}")
        print(f"   markers midtrans={leak['midtrans']} stripe={leak['stripe']}")


asyncio.run(main())
