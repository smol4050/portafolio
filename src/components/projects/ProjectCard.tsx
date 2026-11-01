
import type { Locale, Project } from '../../types/project'
import type { Copy } from '../../data/translations'

interface ProjectCardProps {
  project: Project
  locale: Locale
  labels: Copy
  onOpen: (project: Project) => void
  onVisit: (project: Project) => void
  isSelected?: boolean
}

export default function ProjectCard({
  project,
  locale,
  labels,
  onOpen,
  isSelected = false,
}: ProjectCardProps) {
  const statusLabel =
    project.status === 'TERMINADO'
      ? labels.statusDone
      : project.status === 'EN DESARROLLO'
        ? labels.statusProgress
        : labels.statusJam

  return (
    <article
      className={[
        `project-card project-card-${project.number}`,
        isSelected ? 'project-card-selected' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        className="project-card-open"
        type="button"
        onClick={() => onOpen(project)}
        aria-label={`${labels.viewProject}: ${project.name}`}
        aria-pressed={isSelected}
      >
        <div className="project-art" aria-hidden="true">
          <span className="project-art-number">
            {project.number}
          </span>
          <span className="project-art-type">
            {project.type}
          </span>
          <span className="project-art-orbit" />
          <span className="project-art-shape" />
        </div>

        <div className="project-card-content">
          <div className="project-card-meta">
            <span className="project-category">
              {project.category[locale]}
            </span>
            <span className="project-status">
              {statusLabel}
            </span>
          </div>

          <h3>{project.name}</h3>

          <p className="project-description">
            {project.description[locale]}
          </p>

          {project.technologies.length > 0 && (
            <div className="project-tags">
              {project.technologies.map((technology) => (
                <span
                  className="project-tag"
                  key={technology}
                >
                  {technology}
                </span>
              ))}
            </div>
          )}

          <div className="project-card-footer">
            <span className="project-link">
              {labels.viewProject}
              <span aria-hidden="true"> ↗</span>
            </span>
            <span
              className="project-link-indicator"
              aria-hidden="true"
            >
              ↗
            </span>
          </div>
        </div>
      </button>

      {project.url && (
        <a
          className="project-external-link"
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${project.name}: ${labels.openExternal}`}
        >
          {labels.openExternal}
        </a>
      )}
    </article>
  )
}