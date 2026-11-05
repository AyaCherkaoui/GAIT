export type FocusArea = { skill: string; why: string; miniLesson: string };
export type AiPrompt = { prompt: string; whyItHelps: string };
export type SessionOutputs = {
  email: string;
  nextSteps: string[];
  focusAreas: FocusArea[];
  aiPrompts: AiPrompt[];
  dontAskAi: string[];
};
export type SessionNotes = { workedOn: string; struggles: string; wentWell: string };
export type SessionSummary = { id: number; created_at: string; student_name: string; course: string };
export type SessionRecord = SessionSummary & { notes: SessionNotes; outputs: SessionOutputs };

export type Hit = { driveId: string; name: string; url: string; snippet: string; reason?: string };

export type TaskPlan = { steps: string[]; outline: string; questionsToClarify: string[] };
export type TaskRecord = { id: number; created_at: string; title: string; description: string; plan: TaskPlan; related: Hit[] };

export type Turn = { role: "student" | "tutor"; text: string };
export type Feedback = { worked: string[]; missed: string[]; tryNext: string[] };
export type QuizQuestion = { q: string; choices: string[]; answer: number; why: string };
