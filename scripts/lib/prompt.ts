import { createInterface } from 'readline';

const CTRL_C = '\u0003';
const BACKSPACE = ['\u007f', '\b'];
const ENTER = ['\r', '\n'];

export function promptVisible(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Password prompt: shows one "*" per typed character; falls back to visible input with --visible or without a TTY. */
export function promptMasked(question: string): Promise<string> {
  const stdin = process.stdin;
  if (process.argv.includes('--visible') || !stdin.isTTY || !stdin.setRawMode) return promptVisible(question);

  return new Promise((resolve) => {
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (ENTER.includes(c)) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === CTRL_C) process.exit(1);
        if (BACKSPACE.includes(c)) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += c;
          process.stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}
