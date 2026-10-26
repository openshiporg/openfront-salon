import { getWaitlistQueue } from '../actions/waitlist'
import { WaitlistClient } from './WaitlistClient'
import { PlatformPage } from '../../components/salon-ui'

export async function WaitlistPage() {
  const initialQueue = await getWaitlistQueue()

  return (
    <PlatformPage breadcrumbs={[{ type: 'page', label: 'Walk-in waitlist' }]}>
      <WaitlistClient initialQueue={initialQueue} />
    </PlatformPage>
  )
}

export default WaitlistPage
