#!/usr/bin/env node

import { Version } from "./index"
import { getFilesRecursively } from "rjutils-collection"

import yargs from "yargs"
import esbuild from "esbuild"
import child from "child_process"
import path from "path"
import fs from "fs"

const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	underscore: '\x1b[4m',
	blink: '\x1b[5m',
	reverse: '\x1b[7m',
	hidden: '\x1b[8m',
	fg: {
		black: '\x1b[30m',
		red: '\x1b[31m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		magenta: '\x1b[35m',
		cyan: '\x1b[36m',
		white: '\x1b[37m',
		gray: '\x1b[90m',
	}, bg: {
		black: '\x1b[40m',
		red: '\x1b[41m',
		green: '\x1b[42m',
		yellow: '\x1b[43m',
		blue: '\x1b[44m',
		magenta: '\x1b[45m',
		cyan: '\x1b[46m',
		white: '\x1b[47m',
		gray: '\x1b[100m',
		crimson: '\x1b[48m'
	}
}

const prefix = `⚡  ${colors.fg.white}[RJBUILD ${Version.split('.')[0]}]${colors.fg.gray}:${colors.reset}`

yargs
	.scriptName('rjbuild')
	.usage('$0 <command> [args]')
	.version(Version)
	.command(
		'build <folder>',
		'Build a Folder of files',
		((cmd) => cmd
			.positional('folder', {
				type: 'string',
				description: 'The Folder to build',
				demandOption: true
			})
			.option('out', {
				type: 'string',
				description: 'The Folder to output files to',
				alias: ['o'],
				default: './lib',
			})
			.option('format', {
				type: 'string',
				description: 'The Format to use for output files (cjs / esm)',
				alias: ['f'],
				default: 'cjs',
			})
			.option('sourcemap', {
				type: 'boolean',
				description: 'Whether to generate source maps',
				alias: ['s'],
				default: false,
			})
			.option('watch', {
				type: 'boolean',
				description: 'Watch for file changes',
				alias: ['w'],
				default: false,
			})
			.option('index-banner', {
				type: 'string',
				description: 'The Banner to add to the index file',
				alias: ['iB'],
				default: '',
			})
		), (args) => {
			let shell: child.ChildProcess

			const executeWatch = () => {
				const files = getFilesRecursively(path.resolve(args.folder), false)

				const startTime = Date.now()
				console.log(`${prefix} ${colors.fg.gray}Building ${colors.fg.cyan}${files.length} ${colors.fg.gray}Files...`)

				let errored: boolean = false
				try {
					const buildMain = esbuild.buildSync({
						entryPoints: files.map((f) => path.resolve(f)),
						format: args.format as any,
						outdir: path.resolve(args.out),
						allowOverwrite: true,
						sourcemap: args.sourcemap
					})

					const buildIndex = esbuild.buildSync({
						entryPoints: [path.join(path.resolve(args.folder), 'index.ts')],
						format: args.format as any,
						outfile: path.join(path.resolve(args.out), 'index.js'),
						allowOverwrite: true,
						banner: {
							js: args['index-banner']
						}, sourcemap: args.sourcemap
					})
				} catch (error: any) {
					errored = true
				}

				if (errored) console.log(`${prefix} ${colors.fg.red}Error building ${colors.fg.cyan}${files.length} ${colors.fg.red}Files!`)
				else console.log(`${prefix} ${colors.fg.green}Built ${colors.fg.cyan}${files.length} ${colors.fg.green}Files successfully! ${colors.fg.gray}(${Date.now() - startTime}ms)${colors.reset}`)

				if (args.watch) {
					try {
						if (shell?.pid) process.kill(-shell.pid, 'SIGKILL')
					} catch { }

					if (shell) process.stdin.removeAllListeners()

					console.log(`${prefix} ${colors.fg.gray}Restarting Node...${colors.reset}`)
					shell = child.spawn(`cd ${path.resolve(args.out)} && node --enable-source-maps index.js`, {
						shell: true,
						detached: true,
						env: process.env
					})

					shell
						.on('error', console.error)
						.once('close', () => undefined)

					shell.stdout?.on('data', (t) => process.stdout.write(String(t)))
					shell.stderr?.on('data', (t) => process.stdout.write(String(t)))
					process.stdin.pipe(shell.stdin!)
				}
			}

			if (args.watch) {
				fs.watch(path.resolve(args.folder), { recursive: true }, executeWatch)
				executeWatch()
			} else executeWatch()
		}
	)
	.help()
	.argv