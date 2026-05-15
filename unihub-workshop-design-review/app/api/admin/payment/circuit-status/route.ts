import { NextResponse } from 'next/server';
import { PaymentCircuitBreaker } from '@/lib/payments/PaymentCircuitBreaker';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Basic RBAC check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Get breaker instance (it will return the existing singleton)
  // We use a dummy function just to get the instance if it exists
  const breaker = PaymentCircuitBreaker.getBreaker(async () => {});

  return NextResponse.json({
    status: breaker.status, // OPEN, CLOSED, HALF_OPEN
    stats: breaker.stats,   // failures, successes, timeouts, etc.
    name: 'PaymentServiceBreaker'
  });
}
