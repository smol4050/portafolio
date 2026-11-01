
import type { Copy } from '../data/translations'
import BrandMark from '../components/BrandMark'

interface AboutSectionProps {
  t: Copy
}

export default function AboutSection({ t }: AboutSectionProps) {
  return (
    <section className="about-section" id="sobre-mi">
      <div className="about-layout section-container">
        <div className="about-heading">
          <p className="eyebrow">{t.aboutEyebrow}</p>

          <h2>
            {t.aboutTitle1}
            <br />
            <span>{t.aboutTitle2}</span>
          </h2>

          <div className="about-symbol" aria-hidden="true">
            <BrandMark />
          </div>
        </div>

        <div className="about-content">
          <p className="about-lead">{t.aboutLead}</p>
          <p className="about-detail">{t.aboutText}</p>
          <p className="about-detail">{t.aboutText2}</p>

          <div className="about-facts">
            <div>
              <span className="fact-label">{t.location}</span>
              <span className="fact-value">Colombia</span>
            </div>

            <div>
              <span className="fact-label">{t.education}</span>
              <span className="fact-value">{t.degree}</span>
              <span className="fact-subvalue">{t.university}</span>
              <span className="fact-subvalue">{t.expected}</span>
            </div>

            <div>
              <span className="fact-label">{t.languages}</span>
              <span className="fact-value">{t.spanish}</span>
              <span className="fact-value">{t.english}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}