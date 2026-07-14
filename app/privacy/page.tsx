import type { Metadata } from 'next'
import ContentPage from '../components/ContentPage'

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://predacle.com'
const DESC = 'How Predacle collects, uses, and protects your information.'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: DESC,
  alternates: { canonical: `${SITE}/privacy` },
  openGraph: {
    title: 'Privacy Policy — Predacle', description: DESC, url: `${SITE}/privacy`,
    siteName: 'Predacle', locale: 'en_US', type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Predacle — Every prediction market, one place' }],
  },
}

const sections: [string, string][] = [
  ["Overview", "This Privacy Policy explains what information Predacle collects when you use the site and how we use it. By using Predacle you agree to the practices described here."],
  ["Information we collect", "We collect a limited amount of information: the email address you provide if you subscribe to our newsletter; anonymized usage data such as which markets and links are clicked; and standard technical data your browser sends, such as device and browser type, collected through analytics."],
  ["How we use information", "We use your email only to send the market updates you signed up for. We use usage and technical data to understand how the site is used, improve features, and keep the service reliable. We do not sell your personal information."],
  ["Third-party services", "Predacle links out to prediction-market platforms and relies on third-party services for hosting and analytics. When you click through to another platform, that platform's own privacy policy applies. We are not responsible for the practices of external sites."],
  ["Cookies and analytics", "We use cookies and similar technologies for basic functionality and anonymized analytics. You can control cookies through your browser settings."],
  ["Your choices", "You can unsubscribe from emails at any time via the link in any newsletter. To request access to or deletion of personal data we hold, contact us at the address below."],
  ["Changes to this policy", "We may update this policy from time to time. Material changes will be reflected on this page with an updated date."],
  ["Contact", "Questions about this policy can be sent to [your-contact-email]."],
]

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy" intro="Last updated: [add date]. This is a starter template — review and customize before launch.">
      {sections.map(([h, b], i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{h}</h2>
          <p>{b}</p>
        </div>
      ))}
    </ContentPage>
  )
}
