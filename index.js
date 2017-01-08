const path = require('path')
const cp = require('child_process')
const caption = require('caption')

const args = process.argv

if (args.length < 6) {
    printUsage()
    process.exit(1)
}

const author = args[2]
const heightWidthMax = args[3]
const outdir = args[4]
const file = args[5]

function printUsage() {
    console.log('Usage: node . Author HeightWidthMax outdir file')
}

function getSipsCommand(orientation, file, outfile, z, rotationFuntion, flipFunction) {
    const commands = ['sips']
    if (z) {
        commands.push(`--resampleHeightWidthMax ${z}`)
    }
    const r = typeof rotationFuntion === 'function' ? rotationFuntion(orientation) : null
    const f = typeof flipFunction === 'function' ? flipFunction(orientation) : null
    if (r !== undefined) {
        commands.push(`--rotate ${r}`)
    }
    if (f) {
        commands.push(`--flip ${f}`)
    }
    commands.push(file)
    commands.push(`--out ${outfile}`)
    return commands.join(' ')
}

function getExiftoolWriteCommand(orientation, file, outfile, creator, overwriteOriginal) {
    const commands = ['exiftool', '-all=', '-n']
    if (orientation) {
        commands.push(`-orientation=${orientation}`)
    }
    if (outfile) {
        commands.push(`-o ${outfile}`)
    } else if (overwriteOriginal) {
        commands.push(`-overwrite_original`)
    }
    if (creator) {
        commands.push(`-creator='${creator}'`)
    }
    commands.push(file)
    return commands.join(' ')
}

function getOrientationOutfile(orientation, outdir) {
    return path.join(outdir, `${orientation}.jpg`)
}

function getBlankOutfile(outdir) {
    return path.join(outdir, 'blank.jpg')
}

function readOrientation(file) {
    return `exiftool -n -orientation ${file} -json -q`
}

function getBlankFileCommand(orientation, file, outfile) {
    return getSipsCommand(orientation, file, outfile, heightWidthMax, getInverseRotation, getFlip)
}

const rotationMap = {
    '1': 0,
    '8': 90,
    '7': 90,
    '3': 180,
    '4': 180,
    '6': 270,
    '5': 270,
}

const inverseRotationMap = {
    '1': 0,
    '8': 270,
    '7': 270,
    '3': 180,
    '4': 180,
    '6': 90,
    '5': 90,
}

function getRotation(orientation) {
    return rotationMap[String(orientation)]
}

function getInverseRotation(orientation) {
    return inverseRotationMap[orientation]
}

function getFlip(orientation) {
    if ([2, 7, 4, 5].indexOf(orientation) !== -1) {
        return 'horizontal'
    }
}

function executeCommand(command) {
    console.log(command)
    const res = String(cp.execSync(command))
    console.log(res)
    return res
}

function getInitialOrientation(file) {
    const actualOrientationCommand = readOrientation(file)
    const res = executeCommand(actualOrientationCommand)
    return JSON.parse(res)[0].Orientation
}

function createBlankFile(initialOrientation, file, outdir) {
    const outfile = getBlankOutfile(outdir)
    const blankFileCommand = getBlankFileCommand(initialOrientation, file, outfile)
    const res = executeCommand(blankFileCommand)

    const etwc = getExiftoolWriteCommand(null, outfile, null, author, true)
    const res2 = executeCommand(etwc)

    return outfile
}

function generateFixture(file) {
    const orientations = Array
        .from({ length: 9 })
        .map((value, index) => index)
        .filter(value => value !== 0)

    console.log(orientations)

    const initialOrientation = getInitialOrientation(file)
    console.log('initial orientation: %s', initialOrientation)

    const blankFile = createBlankFile(initialOrientation, file, outdir)

    orientations.forEach(orientation => {
        const outfile = getOrientationOutfile(orientation, outdir)
        const sp = getSipsCommand(orientation, blankFile, outfile, null, getRotation, getFlip)
        executeCommand(sp)
        const et = getExiftoolWriteCommand(orientation, outfile, null, author, true)
        executeCommand(et)
        caption.path(outfile, {
            caption : String(orientation),
            outputFile : outfile,
        }, (err, filename) => {
            console.log('caption %s added to %s', orientation, outfile)
        })
    })
}

generateFixture(file)
