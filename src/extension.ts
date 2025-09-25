import * as vscode from 'vscode';
import { PatchEditorProvider } from './patchEditorProvider';
import { PatchEplorer } from './patchExplorer';
import { PatchPanel } from './patchPanel';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {

	// Register our custom editor providers
	context.subscriptions.push(PatchEditorProvider.register(context));

	context.subscriptions.push(
	 	vscode.commands.registerCommand('gitPatchTools.patchExtract', () => {
	 		// get aggregated patch
			let patch = PatchPanel.ExtractAsPatch();

			// write to file
			const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
			fs.writeFileSync(workspaceFolder.uri.fsPath + "/aggregated.patch", patch, 'utf-8');
			vscode.window.showInformationMessage("New patch file saved: " + "aggregated.path");
	}));

	context.subscriptions.push(
	 	vscode.commands.registerCommand('gitPatchTools.patchSplit', () => {
	 		//CatCodingPanel.createOrShow(context.extensionUri, context);
	 	})
	 );

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
