import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const yaml = require('js-yaml');

export class PatchOpetations {

	public static MergePatches(patch1: string[], patch2: string[]): string[] {
		let result: string[] = [];


		return result;
	}

	public static SplitByPrefix(patch: string[], prefix: string): string[] {
		let result: string[] = [];
		let state: string = 'header';

		let files: string[] = this.ExtractPathsFromPatch(patch, prefix);
		for (let l in patch) {
			if (state === 'header') {
				result.push(l);
				if (l === '---') {
					state = 'files';
				}
			} else if (state === 'files') {
				let parts: string[] = l.split('|');
				if (parts.length === 2) {
					let filename: string = parts[0].trim();
					let matching: boolean = false;
					if (filename.startsWith('...')) {
						// XXX - look in the dictionary
					} else {
						if (filename in files) {
							matching = true;
						}
					}

					if (matching) {
						result.push(l);
						// XXX - do calculations
					}
				} else {
					// XXX - replace summary
					state = 'diff-include';
				}
			} else if (l.startsWith('diff --git ')) {
				// have to change switch
				let parts = l.split(' ');
				let filename = parts[2].substring(2);
				if (filename in files) {
					result.push(l);
					state = 'diff-include';
				} else {
					state = 'diff-exclude';
				}
			} else if (state === 'diff-include') {
				// just copy this line
				result.push(l);
			} else if (state === 'diff-exclude') {
				// skip this line
			}
		}

		return result;
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
}
