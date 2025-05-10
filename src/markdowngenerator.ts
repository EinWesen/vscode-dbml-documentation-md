import * as vscode from 'vscode';
import { tsMarkdown, MarkdownEntryOrPrimitive, TableCell, TableEntry } from 'ts-markdown';

class MarkdownCollector {
    markdown_entries:Array<MarkdownEntryOrPrimitive> = [];

    push_optional_raw(value:string) {
        if (value !== undefined) {
            this.markdown_entries.push({p: {text: value}});
        }
    }

    push(value:MarkdownEntryOrPrimitive):MarkdownEntryOrPrimitive {
        this.markdown_entries.push(value);
        return value;
    }

    push_collector(values:MarkdownCollector) {
        //TODO: Should be possible without an explicit loop
        let self = this;
        values.markdown_entries.forEach((entry) => {
            self.markdown_entries.push(entry);
        });
    }

    push_sourcecode(text:string,language:string|undefined=undefined) {
        this.push({language: language, fenced:true, codeblock: text});
    }
}

export function generateMarkdownDocumentationFromDBML(source_dbml:string):string {
    const markdown_collector = new MarkdownCollector();
    markdown_collector.push_sourcecode(source_dbml);
    return tsMarkdown(markdown_collector.markdown_entries);
}