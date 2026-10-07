export interface AngularRelease {
	tag_name: string;
	name: string | null;
	html_url: string;
	published_at: string | null;
	created_at: string;
	body: string | null;
	prerelease: boolean;
}