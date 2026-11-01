
import type { Copy } from '../data/translations'

interface ApproachSectionProps {
  t: Copy
}

export default function ApproachSection({
  t,
}: ApproachSectionProps) {
  return (
    <section className="approach-section" id="enfoque">
      <div className="approach-inner section-container">
        <div className="approach-heading">
          <p className="eyebrow">{t.approachEyebrow}</p>
          <h2>{t.approachTitle}</h2>
          <p>{t.approachDescription}</p>
        </div>

        <div className="approach-steps">
          <article>
            <span>01</span>
            <div>
              <h3>{t.approachOne}</h3>
              <p>{t.approachOneText}</p>
            </div>
          </article>

          <article>
            <span>02</span>
            <div>
              <h3>{t.approachTwo}</h3>
              <p>{t.approachTwoText}</p>
            </div>
          </article>

          <article>
            <span>03</span>
            <div>
              <h3>{t.approachThree}</h3>
              <p>{t.approachThreeText}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}