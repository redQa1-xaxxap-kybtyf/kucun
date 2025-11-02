import { NextRequest } from 'next/server';
import { GET } from '@/app/api/settings/logs/route';

async function main() {
  process.env.NODE_ENV = 'development';
  const request = new NextRequest('http://localhost/api/settings/logs?page=1&limit=20');
  const response = await GET(request);
  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Body:', JSON.stringify(data, null, 2));
}

main().catch(error => {
  console.error('Error invoking GET:', error);
  process.exit(1);
});

