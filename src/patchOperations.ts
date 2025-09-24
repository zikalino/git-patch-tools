import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const yaml = require('js-yaml');

export class PatchOperations {

	public static FilterByPrefix(patch: string[], prefix: string): string[] {
		let parsed = this.ParsePatch(patch);

		for (let i = parsed['files'].length - 1; i >= 0 ; i--) {
			let f = parsed['files'][i];
			if (!f['filename'].startsWith(prefix)) {
				parsed['files'].splice(i, 1);
			}
		}

		return this.FormatPatch(parsed);
	}

	public static MergePatches(patch1: string[], patch2: string[]): string[] {
		let parsed1 = this.ParsePatch(patch1);
		let parsed2 = this.ParsePatch(patch2);

		parsed1['files'] = [...parsed1['files'], ...parsed2['files']].sort((a, b) => a['filename'].localeCompare(b['filename']));

		// XXX - update header
		// XXX - update summary

		return this.FormatPatch(parsed1);
	}

	public static ExtractPathsFromPatch(patch: string[], prefix: string = ''): string[] {
		let paths: Set<string> = new Set();

		for (let l in patch) {
			let path: string = '';
			if (l.startsWith('--- a/')) {
				path = l.split('--- a/')[1];
			} else if (l.startsWith('+++ b/')) {
				path = l.split('+++ b/')[1];
			}
			if (path.startsWith(prefix)) {
				paths.add(path);
			}
		}

		return Array.from(paths.values());
	}

	public static ParsePatch(patch: string[]) {
		let parsed: any = {
			'header': [],
			'files': [],
			'summary': ''
		};
		let state: string = 'header';
		let fileIndex: number = -1; // we must wait for diff

		for (let i = 0; i < patch.length; i++) {
			let l = patch[i];
			if (state === 'header') {
				if (l === '---') {
					state = 'files';
				} else if (l !== '') {
					parsed.header.push(l);
				}
			} else if (state === 'files') {
				let parts: string[] = l.split('|');
				if (parts.length === 2) {
					let filename: string = parts[0].trim();
					parsed['files'].push({
						'summary': l,
						'filename': '',
						'patch': [],
						'added': 0,
						'removed': 0
					});
				} else {
					// XXX - replace summary
					parsed['summary'] = l;
					state = 'diff';
				}
			} else {
				if (l.startsWith('diff --git ')) {
					fileIndex++;
					let filename = l.split(' b/').pop();
					parsed['files'][fileIndex]['filename'] = filename;
					// XXX - we may need to handle rename
				}
				if (fileIndex >= 0) {
					parsed['files'][fileIndex]['patch'].push(l);
					if (l.startsWith('+')) {
						parsed['files'][fileIndex]['added']++;
					} else if (l.startsWith('-')) {
						parsed['files'][fileIndex]['removed']++;
					}
				}

			}
		}

		return parsed;
	}

	public static FormatPatch(patch: any): string[] {
		let result: string[] = [];

		// push header
		for (let i = 0; i < patch['header'].length; i++) {
			result.push(patch['header'][i]);
		}

		result.push('');
		result.push('---');

		// push summaries
		for (let i = 0; i < patch['files'].length; i++) {
			let f = patch['files'][i];
			result.push(f['summary']);
		}

		// push global summary
		result.push(patch['summary']);

		// push actual changes
		for (let i = 0; i < patch['files'].length; i++) {
			result.push('');
			let f = patch['files'][i];
			for (let j = 0; j < f['patch'].length; j++) {
				result.push(f['patch'][j]);
			}
		}

		return result;
	}
}
