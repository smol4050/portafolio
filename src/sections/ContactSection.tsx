
import type { Copy } from '../data/translations'
import BrandMark from '../components/BrandMark'

interface ContactSectionProps {
  t: Copy
}

export default function ContactSection({
  t,
}: ContactSectionProps) {
  return (
    <footer className="contact-section" id="contact">
      <div className="contact-glow" aria-hidden="true" />

      <div className="contact-inner section-container">
        <p className="eyebrow">{t.contactEyebrow}</p>

        <h2>
          {t.contactTitle1}
          <br />
          <span>{t.contactTitle2}</span>
        </h2>

        <p className="contact-description">
          {t.contactDescription}
        </p>

        <a
          className="button button-primary contact-button"
          href="mailto:stivenmdz28@gmail.com"
        >
          {t.email} <span aria-hidden="true">↗</span>
        </a>

        <div className="footer-bottom">
          <a
            className="footer-brand"
            href="#inicio"
            aria-label="smol4050 — inicio"
          >
            <BrandMark />
            <span>
              smol<span>4050</span>
            </span>
          </a>

          <p>{t.footerNote}</p>

          <a className="back-top" href="#inicio">
            {t.backTop}
          </a>
        </div>
      </div>
    </footer>
  )
}