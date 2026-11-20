"use client";

/** Per-row delete with a confirm prompt. Posts to /admin/leads/delete (behind admin basic auth). */
export default function DeleteLeadButton({ id, email }: { id: number; email: string }) {
  return (
    <form
      method="post"
      action="/admin/leads/delete"
      onSubmit={(e) => {
        if (!confirm(`Permanently delete ${email}? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="link danger-link">
        Delete
      </button>
    </form>
  );
}
