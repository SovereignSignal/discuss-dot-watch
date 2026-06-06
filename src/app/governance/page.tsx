import { redirect } from 'next/navigation';

// The ecosystem dashboards live at /governance/[dao] keyed by Anticapture id; default to Uniswap.
export default function GovernanceIndex() {
  redirect('/governance/uni');
}
