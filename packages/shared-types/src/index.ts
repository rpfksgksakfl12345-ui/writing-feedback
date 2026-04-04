export type Role = "TEACHER" | "STUDENT";

export type SubmissionStatus = "PENDING" | "REVIEWED";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  grade: number | null;
  createdAt: string;
}

export interface Topic {
  id: number;
  title: string;
  description: string | null;
  grade: number;
  createdAt: string;
  teacherId: number;
}

export interface Submission {
  id: number;
  imageUrl: string;
  extractedText: string | null;
  aiFeedback: string | null;
  finalFeedback: string | null;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  studentId: number;
  topicId: number;
}
