import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export class PatchData {

	static _patchData: PatchData|null = null;

	static GetInstance(): any {
		if (!PatchData._patchData) {
			PatchData._patchData = new PatchData();
			PatchData._patchData._LoadPatches();
		}
		return PatchData._patchData;
	}

	public static GetPatchesDict(): any {
		return PatchData.GetInstance()._patchesDict;
	}

	public static GetItemsInPath(path: string): any {
		return PatchData.GetInstance()._getItemsInPath(path);
	}

	public static GetPatchesForPath(path: string): Set<string> {
		return PatchData.GetInstance()._filesDict[path];
	}

	private _filesDict: any = {};
	private _patchesDict: any = {};

	_LoadPatches() {
		const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];


		// XXX - load patch yaml file if exists
		const yamlFileLocation: string = workspaceFolder.uri.fsPath + "/patches.yml";
		if (fs.existsSync(yamlFileLocation)) {
			const fileContents = fs.readFileSync(yamlFileLocation, 'utf8');
			this._patchesDict = yaml.load(fileContents);
		}

		// make sure non-existing files are deleted
		for (let k in this._patchesDict) {
			if (!fs.existsSync(workspaceFolder.uri.fsPath + "/" + k)) {
				delete this._patchesDict[k];
			}
		}

		// XXX - create empty structure if it doesn't


		const files = fs.readdirSync(workspaceFolder.uri.fsPath);

		files.forEach(file => {
			if (file.endsWith('.patch')) {

				if (file.startsWith('chrimall')) {
					console.log("CHRIMALL");
				}
				const filePath: string = workspaceFolder.uri.fsPath + "/" + file;
				const content: string = fs.readFileSync(filePath, 'utf-8');
				const lines: string[] = content.split(/\r?\n/);
				if (!(file in this._patchesDict)) {
					this._patchesDict[file] = {
						annotations: []
					}
				}

				for (const line of lines) {
					if (line.startsWith("--- a/")) {
						let changePath = line.split("--- a/")[1];

						if (!(changePath in this._filesDict)) {
							this._filesDict[changePath] = new Set();
						}
						this._filesDict[changePath].add(file);
					}
				}
			}
		});

		fs.writeFileSync(yamlFileLocation, yaml.dump(this._patchesDict), 'utf8');
	}

	_getItemsInPath(path: string): any {
		let folders: any = {};

		Object.keys(this._filesDict).forEach(key => {

			if (path === '' || key.startsWith(path + '/')) {
				let origKey = key;
				if (path !== "") {
					key = key.slice(1 + path.length);
				}
				let parts = key.split('/');
				let expandable = (parts.length > 1);
				key = parts[0]
				if (!(key in folders)) {
					folders[key] = { expandable: expandable,
									patches: this._filesDict[origKey] };
				} else {
					folders[key]['patches'] = new Set([...folders[key]['patches'], ...this._filesDict[origKey]]);
				}
			}
		});
	
		return folders;
	}
}
