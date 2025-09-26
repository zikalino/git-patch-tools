import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
//import * as mkdirp from 'mkdirp';
//import * as rimraf from 'rimraf';
import { PatchPanel } from './patchPanel';
import { PatchData } from './patchData';
const yaml = require('js-yaml');

//#region Utilities

namespace _ {

	function handleResult<T>(resolve: (result: T) => void, reject: (error: Error) => void, error: Error | null | undefined, result: T): void {
		if (error) {
			reject(massageError(error));
		} else {
			resolve(result);
		}
	}

	function massageError(error: Error & { code?: string }): Error {
		if (error.code === 'ENOENT') {
			return vscode.FileSystemError.FileNotFound();
		}

		if (error.code === 'EISDIR') {
			return vscode.FileSystemError.FileIsADirectory();
		}

		if (error.code === 'EEXIST') {
			return vscode.FileSystemError.FileExists();
		}

		if (error.code === 'EPERM' || error.code === 'EACCES') {
			return vscode.FileSystemError.NoPermissions();
		}

		return error;
	}

	export function checkCancellation(token: vscode.CancellationToken): void {
		if (token.isCancellationRequested) {
			throw new Error('Operation cancelled');
		}
	}

	export function normalizeNFC(items: string): string;
	export function normalizeNFC(items: string[]): string[];
	export function normalizeNFC(items: string | string[]): string | string[] {
		if (process.platform !== 'darwin') {
			return items;
		}

		if (Array.isArray(items)) {
			return items.map(item => item.normalize('NFC'));
		}

		return items.normalize('NFC');
	}

	export function readdir(path: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			fs.readdir(path, (error, children) => handleResult(resolve, reject, error, normalizeNFC(children)));
		});
	}

	export function exists(path: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			fs.exists(path, exists => handleResult(resolve, reject, null, exists));
		});
	}

	//export function rmrf(path: string): Promise<void> {
	//	return new Promise<void>((resolve, reject) => {
	//		rimraf(path, error => handleResult(resolve, reject, error, void 0));
	//	});
	//}

	//export function mkdir(path: string): Promise<void> {
		//return new Promise<void>((resolve, reject) => {
		//	mkdirp(path, error => handleResult(resolve, reject, error, void 0));
		//});
	//}
}

export class FileStat implements vscode.FileStat {

	constructor(private fsStat: fs.Stats) { }

	get type(): vscode.FileType {
		return this.fsStat.isFile() ? vscode.FileType.File : this.fsStat.isDirectory() ? vscode.FileType.Directory : this.fsStat.isSymbolicLink() ? vscode.FileType.SymbolicLink : vscode.FileType.Unknown;
	}

	get isFile(): boolean | undefined {
		return this.fsStat.isFile();
	}

	get isDirectory(): boolean | undefined {
		return this.fsStat.isDirectory();
	}

	get isSymbolicLink(): boolean | undefined {
		return this.fsStat.isSymbolicLink();
	}

	get size(): number {
		return this.fsStat.size;
	}

	get ctime(): number {
		return this.fsStat.ctime.getTime();
	}

	get mtime(): number {
		return this.fsStat.mtime.getTime();
	}
}

interface Entry {
	children: Entry[]|null;
	name: string;
	uri: string;
	folder: boolean;
	patches: Set<string>;
}

//#endregion

export class FileSystemProvider implements vscode.TreeDataProvider<Entry>, vscode.TextDocumentContentProvider {

	constructor() {
		this.root = null;
	}

	// tree data provider

	private root: Entry[]|null;

	async getChildren(element?: Entry): Promise<Entry[]> {

		// if children were already loaded, just return the list
		if (element && element.children) {
			return element.children;
		} else {
			let children = this._loadChildren(element ? element.uri: '');
			if (element) {
				element.children = children;
			} else {
				this.root = children;
			}

			return children;
		}
	}

	getTreeItem(element: Entry): vscode.TreeItem {
		const treeItem = new vscode.TreeItem(element.name, element.folder ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
		//if (element.type === vscode.FileType.File) {
			let metadata: any = {};
			for (let value of element.patches) {
				const patches = PatchData.GetPatchesDict();
				metadata[value] = patches[value];
			}
			treeItem.command = { command: 'patchEplorer.openFile', title: "Open File", arguments: [element.uri, element.patches, metadata], };
			treeItem.contextValue = element.uri;
		//}
		return treeItem;

	}

	// this method from vscode.TreeDataProvider interface needed to enable reveal method.
    // logics should also be more complicated
    getParent(element: Entry): vscode.ProviderResult<Entry>
    {
		let url = element.uri;
		let parts: string[] = url.split('/')
		parts.pop();
		url = parts.join('/');
		let parentEntry = this.findEntry(url);
		if (parentEntry !== null) {
			return parentEntry;
		}
		return null;
    }

	public provideTextDocumentContent(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<string> {
		return "ABC " + uri;
	}

	public findEntry(path: string) {
		if (this.root !== null) {
			return this._findEntry(path, this.root);
		}
		return null;
	}

	private _loadChildren(parentUri: string) {
		let children: Entry[] = [];
		let items = PatchData.GetItemsInPath(parentUri);
		Object.entries(items).sort((a, b) => {
				let av: any = a[1];
				let bv: any = b[1];
				if (av['expandable'] && !bv['expandable']) {
					return -1;
				} else if (!av['expandable'] && bv['expandable']) {
					return 1;
				} else {
					return a[0].localeCompare(b[0])
				}
			}).forEach(entry => {
				let k: string = entry[0];
				let v: any = entry[1];
				children.push(
				{
					name: k,
					children: null,
					uri: parentUri + (parentUri !== '' ? "/" : "") + k,
					folder: v['expandable'],
					patches: v['patches'],
				});
		});
		return children;
	}

	private _findEntry(path: string, nodes: Entry[]): Entry|null {
		for (var i = 0; i < nodes.length; i++) {
			if (path.startsWith(nodes[i].uri)) {
				// if it's equal, we found exact node
				if (path === nodes[i].uri) {
					return nodes[i];
				}
				let children = nodes[i].children;

				if (children === null) {
					children = this._loadChildren(nodes[i].uri);
					nodes[i].children = children;
				}
				return this._findEntry(path, children);
			}
		}
		return null;
	}
}

export class PatchExplorer {
	constructor(context: vscode.ExtensionContext) {
		PatchExplorer._instance = this;
		this._treeDataProvider = new FileSystemProvider();
		this._treeView = vscode.window.createTreeView('patchEplorer', { treeDataProvider: this._treeDataProvider });
		context.subscriptions.push(this._treeView);
		vscode.commands.registerCommand('patchEplorer.openFile', (uri, patches, metadata) => {
			PatchPanel.createOrShow(context.extensionUri, context);

			if (PatchPanel.currentPanel) {
				PatchPanel.currentPanel.update(uri, patches, metadata);
			}
		});
	}

	public static RevealFile(path: string): void {
		PatchExplorer._instance.revealFile(path);
	}

	public revealFile(path: string) {
		let entry = this._treeDataProvider.findEntry(path);
		if (entry === null) {
			return;
		}
		this._treeView.reveal(entry, { select: true, expand: true});
	}

	private static _instance: PatchExplorer;
	private _treeDataProvider: FileSystemProvider;
	private _treeView: vscode.TreeView<Entry>;
}
