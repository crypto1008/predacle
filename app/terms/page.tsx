import type { Metadata } from 'next'
import ContentPage from '../components/ContentPage'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms that govern your use of Predacle.',
}

const sections: [string, string][] = [
  ["Acceptance of terms", "By accessing or using Predacle, you agree to these Terms of Use. If you do not agree, please do not use the site."],
  ["What Predacle is", "Predacle is an aggregator that displays publicly available prediction-market data from third-party platforms. We do not operate a prediction market, accept wagers, hold funds, or execute trades. All trading happens on the source platforms under their own terms."],
  ["Not financial or betting advice", "All content on Predacle, including probabilities, comparisons, and AI-generated summaries, is for informational purposes only. It is not financial, investment, legal, or betting advice. You are solely responsible for any decisions you make."],
  ["Accuracy of information", "We aggregate data from external sources and refresh it periodically. We do not guarantee that any probability, price, or other data is accurate, complete, or current. Always verify on the source platform before acting."],
  ["External links", "Predacle links to third-party platforms. We do not control and are not responsible for the content, availability, or practices of those sites."],
  ["Eligibility and local laws", "Prediction markets and online betting are regulated differently around the world and may be restricted where you live. You are responsible for ensuring your use of any linked platform is legal in your jurisdiction."],
  ["Limitation of liability", "Predacle is provided on an as-is basis without warranties of any kind. To the fullest extent permitted by law, we are not liable for any losses arising from your use of the site or any linked platform."],
  ["Changes to these terms", "We may update these terms from time to time. Continued use of the site after changes constitutes acceptance of the updated terms."],
  ["Contact", "Questions about these terms can be sent to [your-contact-email]."],
]

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Use" intro="Last updated: [add date]. This is a starter template — review and customize before launch.">
      {sections.map(([h, b], i) => (
        <div key={i} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{h}</h2>
          <p>{b}</p>
        </div>
      ))}
    </ContentPage>
  )
}
