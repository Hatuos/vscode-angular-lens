/**
 * Escapes HTML-sensitive characters in a string so they are displayed as text instead of being interpreted as HTML.
 *
 * Prevents HTML/JS injection in user-controlled text.
 * Keeps strings safe when rendered in the DOM or HTML templates.
 * 
 * @param value Input HTML
 * @returns HTML with escaped characters
 */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;"
	})[character] ?? character);
}