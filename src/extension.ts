// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateMarkdownDocumentationFromDBML } from './markdowngenerator';


class VirtualDbmlMdDocumentationProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {

	static readonly URLSCHEME = 'dbml-documentation-md-virtual';

	static getContentFromUri = async function(uri: vscode.Uri): Promise<string> {
		const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
	
		if (openDoc) {
			return Promise.resolve(openDoc.getText());
		} else {
			return vscode.workspace.openTextDocument(uri).then(doc => doc.getText());
		}
	};	
	
	private _changeEmitter = new vscode.EventEmitter<vscode.Uri>();
	private onDidChangeTabsListener?: vscode.Disposable | undefined;
	private onDidChangeTextDocumentListener?: vscode.Disposable | undefined;
	private onDidCloseTextDocumentListener?: vscode.Disposable | undefined;
	private currentSourceUriPath?: string | undefined;
	private currentPreviewUri?: vscode.Uri | undefined;
	
	onDidChange?: vscode.Event<vscode.Uri> = this._changeEmitter.event;

	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		const real_uri = vscode.Uri.parse(decodeURIComponent(uri.fragment));
		
    // Use vscode.window.withProgress to show the progress bar during the content generation
    return vscode.window.withProgress({
		  location: vscode.ProgressLocation.Notification,
		  title: 'Generating DBML-documentation preview...',
		  cancellable: false, // Progress is indeterminate, so we don't need it to be cancellable
		},
		async (progress) => {
		  // Indeterminate progress bar (we update the progress report here)
		  progress.report({ increment: 0 });  // Indeterminate starts with no progress
		  
		  try {
			const source_content = await VirtualDbmlMdDocumentationProvider.getContentFromUri(real_uri);		
			const markdownText = await generateMarkdownDocumentationFromDBML(source_content);
			
			// Step 3: Once content generation is done, resolve the promise with the Markdown
			progress.report({ increment: 100, message: 'Preview ready!' }); // This marks the progress as completed
			
			return markdownText; // Return the final Markdown content to be displayed in the preview
		  } catch (error) {
			// Handle errors gracefully and update the progress bar with an error message
			progress.report({ increment: 100, message: 'Error!' });
			
			vscode.window.showErrorMessage('Could not generate DBML documentation. See preview for details.');

			// Provide an error message in the preview
			return `Could not create preview due to underlying error: ${error}`;
		  }
		}
	  );			
	}
	
	createPreviewTextDocument(sourceDocument:vscode.TextDocument):Thenable<vscode.TextDocument> {
		const filename = `${sourceDocument.fileName}-DBMLDoc.md`;
		const fragment = `${encodeURIComponent(sourceDocument.uri.toString())}`;
		const uri = vscode.Uri.parse(`${VirtualDbmlMdDocumentationProvider.URLSCHEME}:${filename}#${fragment}`);
		return vscode.workspace.openTextDocument(uri);
	}

	disposeListeners() {
		this.onDidChangeTabsListener?.dispose();
		this.onDidChangeTabsListener = undefined;
		this.onDidChangeTextDocumentListener?.dispose();
		this.onDidChangeTextDocumentListener = undefined;
		this.onDidCloseTextDocumentListener?.dispose();
		this.onDidCloseTextDocumentListener = undefined;
		this.currentSourceUriPath = undefined;		
	}	
	
	onDidOpenPreviewTextDocument(doc: vscode.TextDocument) {
		this.currentSourceUriPath = decodeURIComponent(doc.uri.fragment);
		this.currentPreviewUri = doc.uri;

		if (!this.onDidChangeTabsListener) {
			console.log('Registering eventlisteners due to open preview');
			
			const self = this;
			this.onDidChangeTabsListener = vscode.window.tabGroups.onDidChangeTabs((event) => {								

				const wasClosed = event.closed.some(tab => {
					// Some tabs may have non-text inputs (diffs, terminals, etc.)
					if (tab.input instanceof vscode.TabInputText) {
						// Since there can be only one markdown-preview it seems, its enough to check for the scheme
						return tab.input.uri.scheme === VirtualDbmlMdDocumentationProvider.URLSCHEME;
					}
					return false;
				});
			
				if (wasClosed) {
					self.onDidClosePreviewWindow();
				}
			});	
			
			this.onDidCloseTextDocumentListener = vscode.workspace.onDidCloseTextDocument(doc => {
				if (self.currentSourceUriPath !== undefined && doc.uri.toString() === self.currentSourceUriPath) {
					self.currentSourceUriPath = undefined;					
				}
			});		

			/* For now, the only react to saves as change, that way we need no debounce
			 * and real live tracking is not as usefuil anyway 
			 */
			this.onDidChangeTextDocumentListener = vscode.workspace.onDidSaveTextDocument(doc => {						
				if (self.currentSourceUriPath !== undefined && self.currentSourceUriPath === doc.uri.toString()) {
					self.onDidChangeSourceDocument({
						document:doc, contentChanges:[], reason:undefined
					});
				}
			});				
			
		}
		
	}
	
	onDidClosePreviewWindow() {
		console.log('Disposing eventlisteners due to closed preview');
		this.disposeListeners();
	}

	onDidChangeSourceDocument(event: vscode.TextDocumentChangeEvent) {
		// Should always be the case, when we reach here
		if (this.currentPreviewUri !== undefined)  {
			console.log(`Source document changed: ${event.document.uri.toString()}`);		
			this._changeEmitter.fire(this.currentPreviewUri);
		}
	}
	
	dispose() {
		this.disposeListeners();
	}	

};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "dbml-documentation-md" is now active!');

	const virtualDocumentProvider = new VirtualDbmlMdDocumentationProvider();
	context.subscriptions.push(virtualDocumentProvider); // Notify of deactivation that way
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(VirtualDbmlMdDocumentationProvider.URLSCHEME, virtualDocumentProvider));

	// These commands has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('dbml-documentation-md.createMD', async () => {
		console.log('Generating new markdown file for activeEditor');
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {	
			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Generating DBML-documentation preview...',
				cancellable: false, // Progress is indeterminate, so we don't need it to be cancellable
			  },
			  async (progress) => {
				// Indeterminate progress bar (we update the progress report here)
				progress.report({ increment: 0 });  // Indeterminate starts with no progress

				generateMarkdownDocumentationFromDBML(activeEditor.document.getText()).then(
					async (markdown_text) => {
						
						progress.report({ increment: 99, message: 'Content ready!' }); 
						const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown_text });			
						vscode.window.showTextDocument(doc, { preview: false });					

						progress.report({ increment: 100, message: 'DBML documentation created!' }); // This marks the progress as completed
					},
					async (error_text) => {
						// Handle errors gracefully and update the progress bar with an error message
						progress.report({ increment: 100, message: 'Error!' }); //vanished immediately any, no need to be detailed
						vscode.window.showErrorMessage(`Could not create document due to underlying error: ${error_text}`);
					}
				);

			  }
			);							
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
			
			// Seems the window can still not be open at this point, give it a bit of time
			setTimeout(() => {
				virtualDocumentProvider.onDidOpenPreviewTextDocument(doc);
			}, 1000); 
		}
	}));		
}

// This method is called when your extension is deactivated
export function deactivate() {

}