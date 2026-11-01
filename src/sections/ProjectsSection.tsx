
import { useState } from 'react'
import type { Locale, Project } from '../types/project'
import { projects, projectDetails } from '../data/projects'
import type { Copy } from '../data/translations'
import ProjectCard from '../components/projects/ProjectCard'

interface ProjectsSectionProps {
  locale: Locale
  t: Copy
}

export default function ProjectsSection({
  locale,
  t,
}: ProjectsSectionProps) {
  const [selectedProject, setSelectedProject] =
    useState<Project | null>(null)

  const completedProjects = projects.filter(
    (project) => project.status !== 'EN DESARROLLO',
  )

  const inProgressProjects = projects.filter(
    (project) => project.status === 'EN DESARROLLO',
  )

  const selectedDetails = selectedProject
    ? projectDetails[selectedProject.number]
    : undefined

  const renderProjectGrid = (items: Project[]) => (
    <div className="project-grid">
      {items.map((project) => (
        <ProjectCard
          key={project.number}
          project={project}
          locale={locale}
          labels={t}
          onOpen={setSelectedProject}
          onVisit={(item) => {
            if (item.url) {
              window.open(
                item.url,
                '_blank',
                'noopener,noreferrer',
              )
            } else {
              setSelectedProject(item)
            }
          }}
          isSelected={selectedProject?.number === project.number}
        />
      ))}
    </div>
  )

  return (
    <section className="projects section-container" id="projects">
      <div className="section-heading projects-heading">
        <div>
          <p className="eyebrow">{t.selected}</p>
          <h2>{t.projectsTitle}</h2>
          <p className="section-description">
            {t.projectsDescription}
          </p>
        </div>

        <span className="projects-count">
          {String(projects.length).padStart(2, '0')}
          <small> PROJECTS</small>
        </span>
      </div>

      {selectedProject && selectedDetails && (
        <article className="project-detail" aria-live="polite">
          <button
            className="project-detail-back"
            type="button"
            onClick={() => setSelectedProject(null)}
          >
            ← {t.backToProjects}
          </button>

          <p className="eyebrow">
            {selectedProject.number} /{' '}
            {selectedProject.category[locale]}
          </p>

          <h3 className="project-detail-title">
            {selectedProject.name}
          </h3>

          <p className="project-detail-overview">
            {selectedDetails.overview[locale]}
          </p>

          <div className="project-detail-meta">
            <div>
              <span className="fact-label">{t.projectRole}</span>
              <p>{selectedDetails.role[locale]}</p>
            </div>

            <div>
              <span className="fact-label">
                {t.projectHighlights}
              </span>

              {selectedDetails.highlights[locale].length > 0 ? (
                <ul>
                  {selectedDetails.highlights[locale].map(
                    (highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ),
                  )}
                </ul>
              ) : (
                <p>{t.detailsSoon}</p>
              )}
            </div>
          </div>

          {selectedProject.url && (
            <a
              className="button button-primary"
              href={selectedProject.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.openExternal}
            </a>
          )}
        </article>
      )}

      <div className="projects-section-heading">
        <h3>{t.completed}</h3>
        <span>
          {String(completedProjects.length).padStart(2, '0')}
        </span>
      </div>

      {renderProjectGrid(completedProjects)}

      <div className="projects-section-heading in-progress-heading">
        <h3>{t.inProgress}</h3>
        <span>
          {String(inProgressProjects.length).padStart(2, '0')}
        </span>
      </div>

      {renderProjectGrid(inProgressProjects)}
    </section>
  )
}