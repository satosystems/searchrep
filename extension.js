'use strict'

const fs = require('fs')
const path = require('path')
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode')

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

const getCanonicalPath = (workingDirectory, gotPath) => {
  const maybeAbsolutePath = `${workingDirectory || ''}${gotPath}`

  if (maybeAbsolutePath.startsWith('~')) {
    return `${process.env.HOME}${maybeAbsolutePath.substring(1)}`
  }
  // TODO: Windows support
  return maybeAbsolutePath
}

/**
 * @param {vscode.ExtensionContext} context
 */
const activate = context => {
  // Use the console to output diagnostic information (console.info) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.info('Congratulations, your extension "searchrep" is now active!')

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('searchrep.replace', () => {
    // The code you place here will be executed every time your command is executed

    if (vscode.window.activeTextEditor === undefined || vscode.window.activeTextEditor.document.uri.scheme !== 'search-editor') {
      vscode.window.showInformationMessage('Please execute on the search results.')
      return
    }

    const workingDirectory = vscode.workspace.workspaceFolders !== undefined ? `${vscode.workspace.workspaceFolders[0].uri.path}${path.sep}` : null
    const lines = vscode.window.activeTextEditor.document.getText().split('\n')

    const getTargetFilePath = number => {
      const result = lines[number].match(/^(?<path>.+):$/)
      if (result === null) {
        return null
      }
      return getCanonicalPath(workingDirectory, result.groups.path)
    }

    const files = []
    for (let i = 0; i < lines.length; i++) {
      const filePath = getTargetFilePath(i)
      if (filePath !== null) {
        const file = { path: filePath, linesToReplace: {}, lines: [], isReplaced: false, maxLineNumber: 0 }
        i++
        for (; i < lines.length; i++) {
          const line = lines[i]
          if (line === '') {
            continue
          }
          if (getTargetFilePath(i) !== null) {
            i--
            break
          }
          const result = line.match(/^ +(?<number>\d+)( |:) (?<text>.*)$/)
          if (result === null) {
            continue
          }
          file.maxLineNumber = Number.parseInt(result.groups.number) - 1
          file.linesToReplace[file.maxLineNumber] = result.groups.text
        }
        files.push(file)
      }
    }

    files.forEach(file => {
      fs.readFile(file.path, (err, data) => {
        if (err) {
          vscode.window.showInformationMessage(err.message)
          return
        }
        let text = data.toString()
        for (let i = 0; text !== ''; i++) {
          if (i > file.maxLineNumber && !file.isReplaced) {
            break
          }
          const found = text.match(/(?<text>[^\r\n]*)(?<lf>\r\n|\r|\n)?/)
          if (found === null) {
            break
          }
          const line = found.groups
          text = text.substring(found.groups.text.length + (found.groups.lf !== undefined ? found.groups.lf.length : 0))
          const newText = file.linesToReplace[i]
          if (newText !== undefined && line.text !== newText) {
            line.text = newText
            file.isReplaced = true
          }
          file.lines.push(line)
        }
        if (file.isReplaced) {
          const newText = file.lines.reduce((acc, cur) => `${acc}${cur.text}${cur.lf !== undefined ? cur.lf : ''}`, '')
          fs.writeFileSync(file.path, newText)
          // Display a message box to the user
          vscode.window.showInformationMessage(`Replaced file: "${file.path}"`)
        }
      })
    })
  })

  context.subscriptions.push(disposable)
}

exports.activate = activate

// this method is called when your extension is deactivated
const deactivate = () => { }

module.exports = {
  activate,
  deactivate
}
