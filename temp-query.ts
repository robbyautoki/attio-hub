import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  // Execution logs für cal.com workflow (nicht reminder)
  console.log('=== Cal.com Workflow Execution Logs - Company Check ===\n');
  const calcomLogs = await client.execute(`
    SELECT * FROM execution_logs
    WHERE workflow_id != 'reminder-cron-workflow'
    ORDER BY started_at DESC
    LIMIT 10
  `);

  console.log('Anzahl:', calcomLogs.rows.length);

  for (const row of calcomLogs.rows) {
    const startedAt = new Date(Number(row.started_at) * 1000);
    console.log(`\n========================================`);
    console.log(`Zeit: ${startedAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`);
    console.log(`Status: ${row.status}`);

    // Parse step_logs um Company zu sehen
    if (row.step_logs) {
      try {
        const steps = JSON.parse(row.step_logs as string);

        // Finde den Deal-Step
        const dealStep = steps.find((s: { name: string }) => s.name.includes('Deal'));
        if (dealStep) {
          console.log(`\nDeal Step:`);
          console.log(`  Status: ${dealStep.status}`);
          console.log(`  Input: ${JSON.stringify(dealStep.input)}`);

          // Prüfe ob companyRecordId gesetzt wurde
          if (dealStep.input?.companyRecordId) {
            console.log(`  ✅ Company gefunden: ${dealStep.input.companyRecordId}`);
          } else {
            console.log(`  ❌ KEINE Company gefunden!`);
          }

          // Prüfe im Output
          if (dealStep.output?.data?.values?.associated_company) {
            const company = dealStep.output.data.values.associated_company;
            console.log(`  Associated Company im Deal: ${JSON.stringify(company)}`);
          }
        }

        // Zeige auch Parse Step für Email
        const parseStep = steps.find((s: { name: string }) => s.name.includes('Parse'));
        if (parseStep?.output?.email) {
          const email = parseStep.output.email;
          const domain = email.split('@')[1];
          console.log(`\n  Email: ${email}`);
          console.log(`  Domain: ${domain}`);
        }
      } catch {
        // ignore
      }
    }
  }
}

main().catch(console.error);
