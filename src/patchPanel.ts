import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PatchOperations } from './patchOperations';


function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `media` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
	};
}

/**
 * Manages git patch tools webview panels
 */
export class PatchPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: PatchPanel | undefined;

	public static readonly viewType = 'gitPatchToolsXXX';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _context: vscode.ExtensionContext;

	public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (PatchPanel.currentPanel) {
			PatchPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			PatchPanel.viewType,
			'Git Patch',
			column || vscode.ViewColumn.One,
			getWebviewOptions(extensionUri),
		);

		PatchPanel.currentPanel = new PatchPanel(panel, extensionUri, context);
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
		PatchPanel.currentPanel = new PatchPanel(panel, extensionUri, context);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._context = context;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			() => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public update(resource: string, patches: Set<string>, metadata: any) {

		const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
		let loadedPatches = [];

		for (let patch of patches.values()) {
			const filePath: string = workspaceFolder.uri.fsPath + "/" + patch;
			const content: string = fs.readFileSync(filePath, 'utf-8');

			// XXX - temporary here
			const lines: string[] = content.split(/\r?\n/);
			//let parsed = PatchOpetations.ParsePatch(lines);
			//let formatted = PatchOpetations.FormatPatch(parsed);
			let filtered_lines = PatchOperations.FilterByPrefix(lines, resource);


			loadedPatches.push({
				name: patch,
				content: content,
				metadata: metadata[patch]
			})
		}

		this._panel.webview.postMessage({
			type: 'update',
			uri: resource,
			patches: loadedPatches
		});

	}

	public dispose() {
		PatchPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		this._panel.title = "Patches";
		this._panel.webview.html = getHtmlForWebview(this._panel.webview, this._extensionUri, this._context);
	}
}

export function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
	// Local path to main script run in the webview
	const scriptPathOnDisk = vscode.Uri.joinPath(extensionUri, 'media', 'main.js');

	// And the uri we use to load this script in the webview
	const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

	// Local path to css styles
	const styleResetPath = vscode.Uri.joinPath(extensionUri, 'media', 'reset.css');
	const stylesPathMainPath = vscode.Uri.joinPath(extensionUri, 'media', 'vscode.css');

	// Uri to load styles into webview
	const stylesResetUri = webview.asWebviewUri(styleResetPath);
	const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

	// Use a nonce to only allow specific scripts to be run
	const nonce = getNonce();

	let htmlPath =  context.asAbsolutePath(path.join('media', 'patch-viewer.html'));
	let html = fs.readFileSync(htmlPath, 'utf-8');
	
	return html;
	//`<!DOCTYPE html>
	// 	<html lang="en">
	// 	<head>
	// 		<meta charset="UTF-8">

	// 		<!--
	// 			Use a content security policy to only allow loading images from https or from our extension directory,
	// 			and only allow scripts that have a specific nonce.
	// 		-->
	// 		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

	// 		<meta name="viewport" content="width=device-width, initial-scale=1.0">

	// 		<link href="${stylesResetUri}" rel="stylesheet">
	// 		<link href="${stylesMainUri}" rel="stylesheet">

	// 		<title>Git Patch</title>
	// 	</head>
	// 	<body>
	// 		<img src="${catGifPath}" width="300" />
	// 		<h1 id="lines-of-code-counter">0</h1>

	// 		<script nonce="${nonce}" src="${scriptUri}"></script>
	// 	</body>
	// 	</html>`;
}
