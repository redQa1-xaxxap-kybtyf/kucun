import { redirect } from 'next/navigation';

export default function LegacyCustomerStatementsPage() {
  redirect('/finance/statements');
}
