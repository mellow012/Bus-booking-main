import { execSync } from 'child_process';

try {
  console.log('Checking database...\n');
  
  const result = execSync(`npx prisma db execute --stdin --file - << 'EOF'
SELECT count(*) as operator_count FROM "Operator";
SELECT count(*) as company_count FROM "Company";
SELECT count(*) as schedule_count FROM "Schedule";
SELECT count(*) as schedule_with_operator FROM "Schedule" WHERE "operatorId" IS NOT NULL;
EOF
`, { encoding: 'utf-8' });

  console.log(result);
  console.log('✅ Database verification complete!');
} catch (error) {
  console.error('Error:', error);
}
