import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { PatchData } from './patchData';
import { PatchPanel } from './patchPanel';
import { PatchOperations } from './patchOperations';

import { getHtmlForWebview, getNonce } from './patchPanel';

/**
 * Provider for cat scratch editors.
 * 
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 * 
 * This provider demonstrates:
 * 
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
export class PatchEditorProvider implements vscode.CustomTextEditorProvider {

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new PatchEditorProvider(context);
		const providerRegistration = vscode.window.registerCustomEditorProvider(PatchEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'gitPatchTools.patchEditor';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = getHtmlForWebview(webviewPanel.webview, this.context.extensionUri, this.context);

		function updateWebview() {

			let patchesDict = PatchData.GetPatchesDict();
			var filename: any = document.fileName;
			filename = filename.split('\\').at(-1);
			filename = filename.split('/').at(-1); 

			let patch = patchesDict[filename];
			let annotations = patch['annotations']


			let content = document.getText();
			let stats: any = PatchOperations.Patch_GetStatistics(content.split(/\r?\n/), '');
			let totalFilesChanged = stats['totalFilesChanged'];
			let totalLinesAdded = stats['totalLinesAdded'];
			let totalLinesRemoved = stats['totalLinesRemoved'];


			webviewPanel.webview.postMessage({
				type: 'update',
				uri: '',
				patches: [ { name: filename,
							 content: document.getText(),

							 metadata: {
								annotations: annotations
							 }
							}],
				totalFilesChanged: totalFilesChanged,
				totalLinesAdded: totalLinesAdded,
				totalLinesRemoved: totalLinesRemoved
			});
		}

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

		// Receive message from the webview.
		webviewPanel.webview.onDidReceiveMessage(e => {
			switch (e.type) {
				case 'open-patch':
					// open patch file
					vscode.commands.executeCommand('vscode.open', e['name'])
					return;

				case 'open-file-summary':
					// get patches for path
					let patches: Set<string> = PatchData.GetPatchesForPath(e['path'])

					// create patches metadata
					let metadata: any = {};
					for (let value of patches) {
						const patches = PatchData.GetPatchesDict();
						metadata[value] = patches[value];
					}

					PatchPanel.createOrShow(this.context.extensionUri, this.context);

					if (PatchPanel.currentPanel) {
						PatchPanel.currentPanel.update(e['path'], patches, metadata);
					}

					return;
			}
		});

		updateWebview();
	}
}