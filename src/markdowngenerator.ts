import { tsMarkdown, MarkdownEntryOrPrimitive, TableCell, TableEntry } from 'ts-markdown';
import { Parser } from '@dbml/core';
import Database from '@dbml/core/types/model_structure/database';
import Enum from '@dbml/core/types/model_structure/enum';
import Schema from '@dbml/core/types/model_structure/schema';
import Table from '@dbml/core/types/model_structure/table';
import Endpoint from '@dbml/core/types/model_structure/endpoint';
import Field from '@dbml/core/types/model_structure/field';
import Index from '@dbml/core/types/model_structure/indexes';

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
};

class MarkdownDocumentationGenerator {
    static readonly TABLE_INFO_PROPERTIES = ['pk', 'name', 'type', 'unique', 'not_null', 'dbdefault', 'increment', 'note'];

    private markdownCollector:MarkdownCollector = new MarkdownCollector();
    private database:Database;

    constructor(dbml_string:string) {
        // parse DBML to Database 
        console.log(dbml_string);
        this.database = new Parser().parse(dbml_string, 'dbml');
    };

    private isReferencedColumn(schema:Schema, tableName:string, columnName:string):boolean {    
        // TODO: Not sure this worlks correctly with tables from multiple schemas
        return schema.refs.some((ref) => {
            return ref.endpoints.some((endpoint) => {
                return endpoint.tableName === tableName && (endpoint.schemaName ?? 'public') === schema.name && endpoint.fieldNames.includes(columnName);
            });     
        }); 
    };

    private createJoinIdentfierString(endpoint:Endpoint):string {
        let result = [];
        if (endpoint.schemaName) {
            result.push(endpoint.schemaName);
            result.push('.');
        }
    
        result.push(endpoint.tableName);
    
        if (endpoint.fieldNames.length>1) {
            result.push(endpoint.fieldNames.join('['));
            result.push(endpoint.fieldNames.join(','));
            result.push(endpoint.fieldNames.join(']'));
        } else {
            result.push('.');
            result.push(endpoint.fieldNames[0]);
        }
    
        return result.join('');
    };
    
    private createJoinRelationString(start:Endpoint, end:Endpoint):string {
        let result = [];
        result.push(this.createJoinIdentfierString(start));
        result.push('  ');
        result.push(start.relation);
        result.push(' -- ');
        result.push(end.relation);
        result.push('  ');
        result.push(this.createJoinIdentfierString(end));
        return result.join('');
    };    

    private createIndexString(indexObj:Index):string {
        let index_str = [];
        if (indexObj.unique) {
            index_str.push('UNIQUE');
        }
        if (indexObj.type) {
            index_str.push(indexObj.type);
        }
        index_str.push('INDEX');
        index_str.push('(');
        
        indexObj.columns.forEach((colItem, cidx) => {
            if (cidx > 0) {
                index_str.push(',');
            }
            if (colItem.type === 'column') {
                index_str.push(colItem.value);
            } else {
                index_str.push(`'${colItem.value}'`);
            }
        });
        
        index_str.push(')');
        
        return index_str.join(' ');
    }

    private addSchema(schema:Schema) {
        const self = this;
        const hasTableGroups = schema.tableGroups?.length > 0;

        if (this.database.schemas.length > 1) {
            this.markdownCollector.push({h2: `🗃️  ${schema.name}`});
            this.markdownCollector.push_optional_raw(schema.note);
        }        

        if (schema.enums?.length > 0) {
            if (hasTableGroups) {
                this.markdownCollector.push({"h3": '🏷️ Enumerations'});
            }

            schema.enums.forEach((enum_item) => this.addEnum.apply(self, [enum_item, hasTableGroups]));
        } 
        
        if (schema.tableGroups?.length > 0) {

            schema.tableGroups.forEach((table_group) => {
                this.markdownCollector.push({"h3": `🗂️ ${table_group.name}`});
                this.markdownCollector.push_optional_raw(table_group.note);
                
                table_group.tables.forEach(table => this.addTable(table, 4));
            });
        
            this.markdownCollector.push({h3: "🗂️ tables"});
            this.markdownCollector.push({text: "Default Table Group"});
    
            schema.tables.forEach((table) => {
                if (!table.group) {
                    this.addTable(table, 4);
                }
            });
        
        } else {
            schema.tables.forEach(table => this.addTable(table, 3));
        }        
    };
    
    private addEnum(enum_item:Enum, hasTableGroups:boolean) {
        if (hasTableGroups) {
            this.markdownCollector.push({"h4": `🏷️  ${enum_item.name}`});
        } else {
            this.markdownCollector.push({"h3": `🏷️  ${enum_item.name}`});
        }    

        let enum_table_entry:TableEntry = {
            table: {
                columns: ['enum value', 'note'],
                rows: []
            }
        };

        enum_item.values?.forEach((item) => {                
            enum_table_entry.table.rows.push([item.name, item.note]);
        });

        this.markdownCollector.push(enum_table_entry);
        this.markdownCollector.push_optional_raw(enum_item.note);
    };

    private addTable(table:Table, atLevel:number) {
        const tableCollector:MarkdownCollector = new MarkdownCollector();
        
    //    let tbl_display_name:Array<MarkdownEntryOrPrimitive> = [table.name]
    //    if (table.alias) {
    //        tbl_display_name.push({italic: '(' + table.alias + ')'})
    //    }
    
        let tbl_display_name = '📄 ' + table.name;
        if (table.alias) {
            tbl_display_name += ' (' + table.alias + ')';
        }
    
        switch(atLevel) {
            case 3:
                tableCollector.push({h3: tbl_display_name});
                break;
            case 4:
            default:
                tableCollector.push({h4: tbl_display_name});
        }
        
        tableCollector.push_optional_raw(table.note);
    
        let table_entry:TableEntry = {
            table: {
                columns: MarkdownDocumentationGenerator.TABLE_INFO_PROPERTIES,
                rows: []
            }
        };
    
        table.fields.forEach((field) => {
            let field_infos:Array<TableCell> = [];
            MarkdownDocumentationGenerator.TABLE_INFO_PROPERTIES.forEach((property) => {
                switch(property) {
                    case 'pk':
                        if (field.pk) {
                            field_infos.push('🔑');
                        } else if (this.isReferencedColumn(field.table.schema, field.table.name, field.name)) {
                            field_infos.push('🔗');
                        } else {
                            field_infos.push(undefined);
                        }
                        break;
                    case 'type':
    
                        if(field.type.schemaName) {
                            field_infos.push(field.type.schemaName + '.' + field.type.type_name);
                        } else {
                            field_infos.push(field.type.type_name);
                        }
                        break;   
                    default:
                        field_infos.push(field[property as keyof Field]);
                }
            });
            table_entry.table.rows.push(field_infos??'');
        });
    
        tableCollector.push(table_entry);
        
        this.appendTableIndexes(tableCollector, table);
        this.appendTableRefs(tableCollector, table);
        this.markdownCollector.push_collector(tableCollector);
    };

    private appendTableRefs(tableCollector:MarkdownCollector, table:Table) {
        
        // TODO: Better representation needed
        let ref_strings:Array<MarkdownEntryOrPrimitive> = [];
        table.schema.refs.forEach((ref) => {
            let idx_start = -1;
            let idx_end = -1;
            if (ref.endpoints.length === 2) {
                ref.endpoints.forEach((endpoint, idx_loop) => {
                    if (endpoint.tableName === table.name && (endpoint.schemaName ?? 'public') === table.schema.name) {
                        if (idx_start === -1) {
                            idx_start = idx_loop;
                        } else {
                            throw Error(`more than 1 endpoint matched on ref ${ref.id}`);
                        }
                    } else {
                        if (idx_end === -1) {
                            idx_end = idx_loop;
                        } else {
                            // no end point matched
                        }
                    }
                });        
            } else {            
                throw Error(`more than 2 endpoints on ref ${ref.id}`);
            }
            if (idx_start > -1) {                
                ref_strings.push({text: this.createJoinRelationString(ref.endpoints[idx_start], ref.endpoints[idx_end])});
            }            
        }); 
    
        if (ref_strings.length > 0) {
            tableCollector.push({h5: 'References'});
            tableCollector.push({p: ref_strings});
        }

    }

    private appendTableIndexes(tableCollector:MarkdownCollector, table:Table) {
        // TODO: Better representation needed
        if (table.indexes?.length > 0) {
            let index_strings:Array<string> = [];
            table.indexes.forEach((indexObj) => {
                if (!indexObj.pk) {
                    index_strings.push(this.createIndexString(indexObj));
                }
            });
            tableCollector.push({h5: 'Indices'});
            tableCollector.push({'ol': index_strings});
        }
    };

    createMarkdownText():string {
        this.markdownCollector.push({h1: `${this.database.name ?? 'DBML'} documentation`});
        this.markdownCollector.push_optional_raw(this.database.note);
        this.database.schemas.forEach(elem => this.addSchema(elem));
        return tsMarkdown(this.markdownCollector.markdown_entries); 
    };
};


export function generateMarkdownDocumentationFromDBML(source_dbml:string):string {
    return new MarkdownDocumentationGenerator(source_dbml).createMarkdownText();
}