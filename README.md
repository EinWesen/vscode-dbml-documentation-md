# vscode-dbml-documentation-md - A Visual Studio Code extension
While the DBML file format is quite readable already, it is not a nice looking documentation you would use in a wiki or something.
This extension aims to remedy that by creating a markdown document that lists all table structures along with teh associated information, similiar lie a db tool would.  

## Features / TODO
- [x] Generate markdown file from DBML
    - [ ] Show references in a nicer way
    - [ ] Show indices in a nicer way
- [x] "Live" preview of current file (on save)

## References

### Documentation
- DBML syntax: https://dbml.dbdiagram.io/docs

### Used libraries
- [@dbml/core](https://dbml.dbdiagram.io/js-module/core)
- [TS Markdown](https://kgar.github.io/ts-markdown/)

### Other usefull extensions
- [vscode-dbml](https://marketplace.visualstudio.com/items/?itemName=matt-meyers.vscode-dbml)
- [DBML Entity-Relationship Diagrams visualizer](https://marketplace.visualstudio.com/items/?itemName=bocovo.dbml-erd-visualizer)
