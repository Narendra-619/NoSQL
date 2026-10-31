import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader.jsx'

export default function NotFoundPage() {
  return (
    <div>
      <PageHeader
        eyebrow="404"
        title="This page is not in the register."
        description="The address may be incomplete, or the record may belong to a different workspace."
      />
      <div className="flex flex-wrap gap-4 border-t border-line pt-6 text-[13px] font-medium">
        <Link to="/" className="text-forest underline decoration-forest/30 underline-offset-4 hover:decoration-forest">
          Return home
        </Link>
        <Link to="/principal" className="text-muted underline decoration-line-strong underline-offset-4 hover:text-forest hover:decoration-forest">
          Open principal overview
        </Link>
      </div>
    </div>
  )
}
