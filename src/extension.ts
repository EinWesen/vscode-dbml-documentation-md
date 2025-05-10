// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateMarkdownDocumentationFromDBML } from './markdowngenerator';


class VirtualDbmlMdDocumentationProvider implements vscode.TextDocumentContentProvider {
	static urlscheme = 'dbml-documentation-md-virtual';

	static getContentFromUri = async function(uri: vscode.Uri): Promise<string> {
		const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
	
		if (openDoc) {
			return Promise.resolve(openDoc.getText());
		} else {
			return vscode.workspace.openTextDocument(uri).then(doc => doc.getText());
		}
	};	

	onDidChange?: vscode.Event<vscode.Uri> | undefined;
	
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const real_uri = vscode.Uri.parse(decodeURIComponent(uri.fragment));
		return VirtualDbmlMdDocumentationProvider.getContentFromUri(real_uri).then(text => {
			return generateMarkdownDocumentationFromDBML(text);
		});
	}
	
	createPreviewTextDocument(sourceDocument:vscode.TextDocument):Thenable<vscode.TextDocument> {
		const filename = `${sourceDocument.fileName}-DBMLDoc.md`;
		const fragment = `${encodeURIComponent(sourceDocument.uri.toString())}`;
		const uri = vscode.Uri.parse(`${VirtualDbmlMdDocumentationProvider.urlscheme}:${filename}#${fragment}`);
		return vscode.workspace.openTextDocument(uri);
	}
};


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "dbml-documentation-md" is now active!');

	const virtualDocumentProvider = new VirtualDbmlMdDocumentationProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(VirtualDbmlMdDocumentationProvider.urlscheme, virtualDocumentProvider));

	// These commands has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('dbml-documentation-md.createMD', async () => {
		console.log('Generating new markdown file for activeEditor');
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {			
			const markdown_text = generateMarkdownDocumentationFromDBML(activeEditor.document.getText());
			const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown_text });			
			await vscode.window.showTextDocument(doc, { preview: false });		
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('dbml-documentation-md.showPreviewMD',  async () => { 
        console.log('Generating markdown preview for activeEditor');
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {			
			// create a virtual doc
			let doc = await virtualDocumentProvider.createPreviewTextDocument(activeEditor.document);
			
			// Show the markdown preview of the virtual doc
			await vscode.commands.executeCommand('markdown.showPreview', doc.uri);				
		}
	}));

}

// This method is called when your extension is deactivated
export function deactivate() {}
