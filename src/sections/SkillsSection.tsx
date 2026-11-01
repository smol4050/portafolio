
import type { Copy } from '../data/translations'

interface SkillsSectionProps {
  t: Copy
}

export default function SkillsSection({ t }: SkillsSectionProps) {
  return (
    <section
      className="skills-section section-container"
      id="skills"
    >
      <div className="section-heading">
        <p className="eyebrow">{t.skillsEyebrow}</p>
        <h2>{t.skillsTitle}</h2>
        <p className="section-description">
          {t.skillsDescription}
        </p>
      </div>

      <div className="skills-grid">
        <article className="skill-card skill-card-development">
          <span className="skill-index">01 / DEV</span>
          <div className="skill-icon" aria-hidden="true">⌘</div>
          <h3>{t.development}</h3>
          <p>{t.developmentDescription}</p>

          <div className="skill-tags">
            <span>Flutter</span>
            <span>JavaScript</span>
            <span>HTML / CSS</span>
          </div>
        </article>

        <article className="skill-card skill-card-games">
          <span className="skill-index">02 / PLAY</span>
          <div className="skill-icon" aria-hidden="true">✳</div>
          <h3>{t.games}</h3>
          <p>{t.gamesDescription}</p>

          <div className="skill-tags">
            <span>Unity</span>
            <span>C#</span>
            <span>Gameplay</span>
          </div>
        </article>

        <article className="skill-card skill-card-qa">
          <span className="skill-index">03 / QA</span>
          <div className="skill-icon" aria-hidden="true">⌕</div>
          <h3>{t.qa}</h3>
          <p>{t.qaDescription}</p>

          <div className="skill-tags">
            {t.qaTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}