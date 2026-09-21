import type { LibrarySnapshot } from "./types";

export const DEMO_PROJECT_ID = "project-field-notes";

export const demoSnapshot: LibrarySnapshot = {
  projects: [
    {
      id: DEMO_PROJECT_ID,
      title: "Public Memory & Community Archives",
      folderPath: "Demo collection · local browser storage",
      createdAt: "2026-08-12T09:30:00.000Z",
    },
  ],
  projectSources: [
    {
      id: "source-demo-collection",
      projectId: DEMO_PROJECT_ID,
      kind: "folder",
      path: "Demo collection",
      label: "Demo collection",
      createdAt: "2026-08-12T09:30:00.000Z",
    },
  ],
  documents: [
    {
      id: "doc-participatory-archives",
      projectId: DEMO_PROJECT_ID,
      title: "Participatory Archives: A Demonstration Paper",
      fileName: "participatory_archives.pdf",
      path: "Demo collection/participatory_archives.pdf",
      kind: "pdf",
      authors: "Mara Bell; I. Okafor",
      publicationDate: "2022-04-18",
      doi: "10.0000/demo.2022.014",
      journal: "Illustrative Archive Studies",
      abstract:
        "A synthetic paper included to demonstrate reading, excerpting, and thematic organisation in Thematic.",
      addedAt: "2026-09-12T08:12:00.000Z",
      pageCount: 3,
      fileAvailable: true,
      content: `# Participatory Archives

## A demonstration paper

Community archives are not simply containers for inherited records. They are continuing negotiations over whose experiences may enter public memory, who describes them, and which forms of evidence a community considers trustworthy.

In the workshops, participants treated description as a social practice rather than a neutral technical stage. A name, date, or subject term could preserve context for one reader while concealing it from another. The catalogue therefore became a place where authority was made visible and open to revision.

---PAGE---

## Shared description

Participants asked that uncertainty remain visible in the record. Instead of replacing local accounts with a single institutional description, the project retained parallel statements and recorded who supplied each interpretation.

Access was understood as more than the ability to retrieve a file. Meaningful access also depended on language, community protocols, technical confidence, and the opportunity to challenge an inaccurate description.

The process changed the archivists' role. Staff moved from being final arbiters of meaning to stewards of a documented conversation, responsible for maintaining both the record and the conditions under which it could be contested.

---PAGE---

## Conclusions

The strongest collections were not those with the most uniform metadata. They were those that made provenance, disagreement, and revision legible without making the catalogue unusable.

Participatory description requires time and ongoing relationships. Its value is not captured by item counts alone; it is also found in the durable capacity of people to recognise themselves in the archive and to correct it when they do not.`,
    },
    {
      id: "doc-reflexive-fieldnotes",
      projectId: DEMO_PROJECT_ID,
      title: "Reflexive Fieldnotes for Collaborative Inquiry",
      fileName: "reflexive_fieldnotes.md",
      path: "Demo collection/reflexive_fieldnotes.md",
      kind: "markdown",
      authors: "Leila Santos",
      publicationDate: "2024-11-02",
      doi: "",
      journal: "Working note",
      abstract:
        "A demonstration Markdown note about positionality, field records, and interpretive accountability.",
      addedAt: "2026-09-13T10:45:00.000Z",
      pageCount: 1,
      fileAvailable: true,
      content: `# Reflexive fieldnotes for collaborative inquiry

> Working note — revised after the third community review session.

Fieldnotes often appear to be private records of observation, but in collaborative inquiry they also shape what partners can later dispute. Recording the researcher's uncertainty makes interpretation available for discussion rather than presenting it as settled fact.

## A two-column habit

I keep description and interpretation adjacent but distinct. The first column records what happened, including phrases used by participants. The second records my assumptions, emotional response, and questions for the next meeting.

This separation is imperfect, yet the visible boundary slows the conversion of an impression into evidence. It also gives collaborators a practical place to add a different reading.

## Review as method

Review sessions should not be treated as a final accuracy check. They are moments of analysis in which participants can change the study's categories, identify absences, and decide that some material should not circulate.

The aim is not to remove the researcher from the account. It is to leave enough of the interpretive trail that readers can understand how a claim came to be made.`,
    },
    {
      id: "doc-catalogue-silences",
      projectId: DEMO_PROJECT_ID,
      title: "Catalogue Silences and the Conditions of Discovery",
      fileName: "catalogue_silences.pdf",
      path: "Demo collection/catalogue_silences.pdf",
      kind: "pdf",
      authors: "Anika Rao; Jules Neri",
      publicationDate: "2019-07-26",
      doi: "10.0000/demo.2019.092",
      journal: "Illustrative Information Review",
      abstract:
        "Synthetic research material for exploring catalogue language and discovery barriers.",
      addedAt: "2026-09-14T06:20:00.000Z",
      pageCount: 2,
      fileAvailable: true,
      content: `# Catalogue Silences

## The conditions of discovery

Search results can look comprehensive while reproducing gaps in description. When inherited terminology is the only route into a collection, people who use different names for the same experience may conclude that the archive contains nothing about them.

Discovery systems distribute attention. Ranking, facets, and default filters are interpretive decisions, even when they are presented as neutral features of an interface.

---PAGE---

## Reading absence

An empty result is ambiguous: the material may never have been collected, may be restricted, may be described under another term, or may not yet be processed. Interfaces rarely make these different kinds of absence distinguishable.

Researchers responded by keeping a vocabulary ledger. Each unsuccessful query was retained alongside alternative terms, collection histories, and conversations with staff. Failure became part of the method rather than an invisible preliminary step.`,
    },
    {
      id: "doc-analysis-memo",
      projectId: DEMO_PROJECT_ID,
      title: "Analysis Memo — September Synthesis",
      fileName: "september_synthesis.md",
      path: "Demo collection/memos/september_synthesis.md",
      kind: "markdown",
      authors: "Research team",
      publicationDate: "2026-09-09",
      doi: "",
      journal: "Internal memo",
      abstract: "A live synthesis memo linking access, voice, and reflexive method.",
      addedAt: "2026-09-15T03:15:00.000Z",
      pageCount: 1,
      fileAvailable: true,
      content: `# September synthesis

Across the first three sources, **access** is described as a relationship rather than a delivery mechanism. The emerging question is: who can recognise the terms of access and renegotiate them?

## Working propositions

1. Descriptive language determines whether a record can be discovered.
2. Participant review changes analysis; it is not merely validation.
3. Keeping uncertainty visible supports later reinterpretation.

The next coding pass should distinguish practical barriers from authority over description. These overlap, but they imply different interventions.`,
    },
  ],
  themes: [
    {
      id: "theme-access",
      projectId: DEMO_PROJECT_ID,
      name: "Conditions of access",
      color: "#8c4b38",
      description: "Practical and interpretive conditions that shape who can find and use a record.",
      createdAt: "2026-09-12T09:00:00.000Z",
    },
    {
      id: "theme-voice",
      projectId: DEMO_PROJECT_ID,
      name: "Participant voice",
      color: "#49634f",
      description: "Whose language, account, and authority are retained in the research record.",
      createdAt: "2026-09-12T09:05:00.000Z",
    },
    {
      id: "theme-reflexivity",
      projectId: DEMO_PROJECT_ID,
      name: "Reflexive method",
      color: "#5d5879",
      description: "Practices that expose the researcher's role in producing interpretation.",
      createdAt: "2026-09-13T11:00:00.000Z",
    },
    {
      id: "theme-uncertainty",
      projectId: DEMO_PROJECT_ID,
      parentId: "theme-reflexivity",
      name: "Visible uncertainty",
      color: "#7b6b91",
      description: "Recording ambiguity and competing readings rather than resolving them prematurely.",
      createdAt: "2026-09-13T11:03:00.000Z",
    },
    {
      id: "theme-description",
      projectId: DEMO_PROJECT_ID,
      parentId: "theme-access",
      name: "Descriptive power",
      color: "#9b6a3e",
      description: "How cataloguing terms and metadata distribute visibility and authority.",
      createdAt: "2026-09-14T06:35:00.000Z",
    },
  ],
  excerpts: [
    {
      id: "excerpt-1",
      documentId: "doc-participatory-archives",
      text: "Community archives are not simply containers for inherited records. They are continuing negotiations over whose experiences may enter public memory, who describes them, and which forms of evidence a community considers trustworthy.",
      annotation: "Useful framing: the archive as an ongoing negotiation, not a finished repository.",
      page: 1,
      createdAt: "2026-09-12T09:20:00.000Z",
      updatedAt: "2026-09-12T09:20:00.000Z",
      themeIds: ["theme-voice"],
    },
    {
      id: "excerpt-2",
      documentId: "doc-participatory-archives",
      text: "Access was understood as more than the ability to retrieve a file. Meaningful access also depended on language, community protocols, technical confidence, and the opportunity to challenge an inaccurate description.",
      annotation: "Access has social and procedural prerequisites. Compare with catalogue failure in Rao & Neri.",
      page: 2,
      createdAt: "2026-09-12T09:28:00.000Z",
      updatedAt: "2026-09-12T09:28:00.000Z",
      themeIds: ["theme-access", "theme-description"],
    },
    {
      id: "excerpt-3",
      documentId: "doc-participatory-archives",
      text: "Participants asked that uncertainty remain visible in the record. Instead of replacing local accounts with a single institutional description, the project retained parallel statements and recorded who supplied each interpretation.",
      annotation: "Plural descriptions preserve provenance of interpretation.",
      page: 2,
      createdAt: "2026-09-12T09:31:00.000Z",
      updatedAt: "2026-09-12T09:31:00.000Z",
      themeIds: ["theme-voice", "theme-uncertainty"],
    },
    {
      id: "excerpt-4",
      documentId: "doc-reflexive-fieldnotes",
      text: "Recording the researcher's uncertainty makes interpretation available for discussion rather than presenting it as settled fact.",
      annotation: "Possible methodological principle for the methods chapter.",
      locator: "Opening section",
      createdAt: "2026-09-13T11:08:00.000Z",
      updatedAt: "2026-09-13T11:08:00.000Z",
      themeIds: ["theme-reflexivity", "theme-uncertainty"],
    },
    {
      id: "excerpt-5",
      documentId: "doc-reflexive-fieldnotes",
      text: "Review sessions should not be treated as a final accuracy check. They are moments of analysis in which participants can change the study's categories, identify absences, and decide that some material should not circulate.",
      annotation: "Member review as analysis and governance, not validation alone.",
      locator: "Review as method",
      createdAt: "2026-09-13T11:15:00.000Z",
      updatedAt: "2026-09-13T11:15:00.000Z",
      themeIds: ["theme-voice", "theme-reflexivity"],
    },
    {
      id: "excerpt-6",
      documentId: "doc-catalogue-silences",
      text: "An empty result is ambiguous: the material may never have been collected, may be restricted, may be described under another term, or may not yet be processed.",
      annotation: "Four analytically distinct kinds of absence concealed by the same UI state.",
      page: 2,
      createdAt: "2026-09-14T06:42:00.000Z",
      updatedAt: "2026-09-14T06:42:00.000Z",
      themeIds: ["theme-access", "theme-description"],
    },
    {
      id: "excerpt-7",
      documentId: "doc-catalogue-silences",
      text: "Discovery systems distribute attention. Ranking, facets, and default filters are interpretive decisions, even when they are presented as neutral features of an interface.",
      annotation: "Interface defaults are an exercise of descriptive power.",
      page: 1,
      createdAt: "2026-09-14T06:48:00.000Z",
      updatedAt: "2026-09-14T06:48:00.000Z",
      themeIds: ["theme-description"],
    },
    {
      id: "excerpt-8",
      documentId: "doc-analysis-memo",
      text: "The next coding pass should distinguish practical barriers from authority over description. These overlap, but they imply different interventions.",
      annotation: "Use this distinction to split the current broad access code.",
      locator: "Closing memo",
      createdAt: "2026-09-15T03:40:00.000Z",
      updatedAt: "2026-09-15T03:40:00.000Z",
      themeIds: ["theme-access", "theme-description"],
    },
  ],
  relationships: [],
  settings: {
    enabled: false,
    provider: "ollama",
    model: "gemma3:4b",
    endpoint: "http://127.0.0.1:11434",
    llamaExecutable: "llama-server",
    llamaModelPath: "",
    llamaMmprojPath: "",
    llamaServerArguments: "--ctx-size 4096 --n-gpu-layers 99",
    llamaEnableVision: false,
    autoSuggest: false,
    defaultNoteFormat: "plain",
    graphLabelMode: "hover",
    graphZoom: 100,
    graphNodeScale: 55,
    defaultReaderZoom: 100,
    defaultExcerptColor: "#efd982",
    defaultNoteColor: "#edb807",
    defaultThemeShape: "square",
    defaultExcerptShape: "circle",
    defaultGraphLayout: "stress",
    uiFontScale: 100,
    ergonomics: {
      density: "comfortable",
      showResumePrompt: true,
      breakReminders: false,
      breakIntervalMinutes: 50,
      sessionTargetKind: "none",
      sessionTargetValue: 4,
      quickCapture: true,
      projects: {},
    },
    onlineCitationLookup: false,
    citationContactEmail: "",
    graphNodePositions: {},
    graphPinnedLabels: [],
    graphWorkspaces: {},
    synthesisWorkspaces: {},
  },
};

export function freshDemoSnapshot(): LibrarySnapshot {
  return JSON.parse(JSON.stringify(demoSnapshot)) as LibrarySnapshot;
}
