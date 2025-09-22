import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CatScratchEditorProvider } from './catScratchEditor';
import { PatchEplorer } from './patchExplorer';



const cats = {
	'Coding Cat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
	'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
	'Testing Cat': 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif'
};

export function activate(context: vscode.ExtensionContext) {

	// Register our custom editor providers
	context.subscriptions.push(CatScratchEditorProvider.register(context));

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand('gitPatchTools.start', () => {
	// 		CatCodingPanel.createOrShow(context.extensionUri, context);
	// 	})
	// );

	// context.subscriptions.push(
	// 	vscode.commands.registerCommand('gitPatchTools.doRefactor', () => {
	// 		if (CatCodingPanel.currentPanel) {
	// 			CatCodingPanel.currentPanel.doRefactor();
	// 		}
	// 	})
	// );

	// if (vscode.window.registerWebviewPanelSerializer) {
	// 	// Make sure we register a serializer in activation event
	// 	vscode.window.registerWebviewPanelSerializer(CatCodingPanel.viewType, {
	// 		async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
	// 			console.log(`Got state: ${state}`);
	// 			// Reset the webview options so we use latest uri for `localResourceRoots`.
	// 			webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
	// 			CatCodingPanel.revive(webviewPanel, context.extensionUri, context);
	// 		}
	// 	});
	// }

	new PatchEplorer(context);
}

