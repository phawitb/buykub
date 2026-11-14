export type CourseDocument = { id: string; name: string; path?: string; url?: string };
export type CourseLesson = {
  id: string;
  title: string;
  position: number;
  content_html: string;
  youtube_url: string | null;
  documents: CourseDocument[];
  published: boolean;
};
export type CourseAccess = { allowed: boolean; reason: "owner" | "active" | "expired" | "refunded" | "not_purchased"; expires_at: string | null };
