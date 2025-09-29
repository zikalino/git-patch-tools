import * as vscode from 'vscode';
import { PatchEditorProvider } from './patchEditorProvider';
import { PatchExplorer } from './patchExplorer';
import { PatchPanel } from './patchPanel';
import * as fs from 'fs';
import { PatchOperations } from './patchOperations';

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
	 	vscode.commands.registerCommand('gitPatchTools.patchesMerge', (item, selection) => {
			const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];
			let mergedPatch: string[]|null = null;

			for (let i = 0; i < selection.length; i++) {
				let patch = fs.readFileSync(selection[i].fsPath, 'utf-8');
				let patchLines = patch.split(/\r?\n/);
				if (mergedPatch === null) {
					mergedPatch = patchLines;
				} else {
					mergedPatch = PatchOperations.MergePatches(mergedPatch, patchLines);
				}
			}

			// add one empty line, so there's CRLF at the end
			if (mergedPatch !== null) {
				mergedPatch.push('');

			fs.writeFileSync(workspaceFolder.uri.fsPath + "/aggregated.patch", mergedPatch.join('\r\n'), 'utf-8');
			vscode.window.showInformationMessage("New patch file saved: " + "aggregated.path");
		}
	}));


	context.subscriptions.push(
	 	vscode.commands.registerCommand('gitPatchTools.patchSplitByFiles', (item, selection) => {
			const workspaceFolder = (vscode.workspace.workspaceFolders ?? []).filter(folder => folder.uri.scheme === 'file')[0];

			let patch = fs.readFileSync(item.fsPath, 'utf-8');
			let patchLines = patch.split(/\r?\n/);
			let paths = PatchOperations.ExtractPathsFromPatch(patchLines, '');
			let filenamePrefix = item.fsPath.split(".patch")[0];

			for (let i = 0; i < paths.length; i++) {
				let extracted = PatchOperations.Patch_RemoveOtherFiles(patchLines, paths[i]);
				fs.writeFileSync(filenamePrefix + "-" + i + ".patch", extracted.join('\r\n'));
			}
		}));

	context.subscriptions.push(
	 	vscode.commands.registerCommand('gitPatchTools.patchSplitByFolders', (item, selection) => {

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

	new PatchExplorer(context);
}
