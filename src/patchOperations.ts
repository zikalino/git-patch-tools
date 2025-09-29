const yaml = require('js-yaml');

export class PatchOperations {

	public static Patch_RemoveOtherFiles(patch: string[], prefix: string): string[] {
		let parsed = this.ParsePatch(patch);

		for (let i = parsed['files'].length - 1; i >= 0 ; i--) {
			let f = parsed['files'][i];
			if (!f['filename'].startsWith(prefix)) {
				parsed['files'].splice(i, 1);
			}
		}

		return this.FormatPatch(parsed);
	}

	public static Patch_RemoveMatchingFiles(patch: string[], prefix: string): string[] {
		let parsed = this.ParsePatch(patch);

		for (let i = parsed['files'].length - 1; i >= 0 ; i--) {
			let f = parsed['files'][i];
			if (f['filename'].startsWith(prefix)) {
				parsed['files'].splice(i, 1);
			}
		}

		return this.FormatPatch(parsed);
	}

	public static MergePatches(patch1: string[], patch2: string[]): string[] {
		let parsed1 = this.ParsePatch(patch1);
		let parsed2 = this.ParsePatch(patch2);

		parsed1['files'] = [...parsed1['files'], ...parsed2['files']].sort((a, b) => a['filename'].localeCompare(b['filename']));

		// check for duplicates
		if (parsed1['files'].length > 1) {
			for (let i = parsed1['files'].length - 2; i >= 0; i--) {
				if (parsed1['files'][i]['filename'] === parsed1['files'][i + 1]['filename']) {

					// XXX - concatenate after @@@
					parsed1['files'][i]['patch'] = [...parsed1['files'][i]['patch'], ...parsed1['files'][i + 1]['patch']];
					parsed1['files'][i]['changes'] = [...parsed1['files'][i]['changes'], ...parsed1['files'][i + 1]['changes']].sort((a, b) => {
						if (a['lineNumberA'] < b['lineNumberA']) {
							return -1;
						} else if  (a['lineNumberA'] > b['lineNumberA']) {
							return 1;
						} else {
							return 0;
						};
				    });
					parsed1['files'].splice(i + 1, 1);
				}
			}
		}

		// XXX - check if patches overlap or not

		return this.FormatPatch(parsed1);
	}

	public static ExtractPathsFromPatch(patch: string[], prefix: string = ''): string[] {
		let paths: Set<string> = new Set();

		for (let i in patch) {
			let l = patch[i];
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
		let change:any = null;

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
					
					change = null;
					parsed['files'][fileIndex]['changes'] = [];
					// XXX - we may need to handle rename
				}
				if (fileIndex >= 0) {
					if (l.startsWith('@')) {
						let fields = l.split(' ');
						let fieldsA = fields[1].split(',');
						let fieldsB = fields[2].split(',');


						change = {
							lineNumberA: Math.abs(Number(fieldsA[0])),
							lineCountA: Number(fieldsA[1]),
							lineNumberB: Number(fieldsB[0]),
							lineCountB: Number(fieldsB[1]),
							lines: []
						}
						parsed['files'][fileIndex]['changes'].push(change)
					}
					if (change === null) {
						parsed['files'][fileIndex]['patch'].push(l);
					} else {
						change['lines'].push(l)
					}
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

	public static FormatSummary(patch: any): void {

		let summary: string = '';
		if (patch['files'].length === 1) {
			summary = " 1 file changed";
		} else {
			summary = " " + patch['files'].length + " files changed"
		}

		let added: number = 0;
		let removed: number = 0;

		for (let i = 0; i < patch['files'].length; i++) {
			let file = patch['files'][i];
			added += file['added'];
			removed += file['removed'];
		}

		if (added > 0) {
			summary += ", " + added + " insertion" + ((added > 1) ? "s" : "") + "(+)";
		}

		if (removed > 0) {
			summary += ", " + removed + " deletion" + ((removed > 1) ? "s" : "") + "(+)";
		}

		patch['summary'] = summary;
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
		this.FormatSummary(patch);
		result.push(patch['summary']);

		// push actual changes
		for (let i = 0; i < patch['files'].length; i++) {
			result.push('');
			let f = patch['files'][i];
			for (let j = 0; j < f['patch'].length; j++) {
				result.push(f['patch'][j]);
			}

			for (let j = 0; j < f['changes'].length; j++) {
				for (let k = 0; k < f['changes'][j]['lines'].length; k++) {
					result.push(f['changes'][j]['lines'][k]);
				}
			}
		}

		return result;
	}
}
