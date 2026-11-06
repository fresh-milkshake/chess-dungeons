export class DungeonEngine {
  constructor() {
    this.worker = new Worker(new URL('./rules-worker.js',import.meta.url),{type:'module'});
    this.pending = new Map();
    this.nextId = 0;
    this.queue=Promise.resolve();
    // Both variant search and rule generation belong off the UI thread.
    this.rules={request:command=>this.rawRequest(command)};
    this.worker.onmessage = ({ data: { id, result, error } }) => {
      const pending = this.pending.get(id);
      if (!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      if (error || result?.error) pending.reject(new Error(error || result.error));
      else pending.resolve(result);
    };
    this.worker.onerror = () => this.fail(new Error('Не удалось загрузить экспериментальный движок'));
    this.worker.postMessage({nativeUrl:new URL(`${import.meta.env.BASE_URL}engine/dungeons-worker.js`,location.href).href});
  }

  fail(error) {
    this.failed = error;
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(error); }
    this.pending.clear();
    this.worker.terminate();
  }

  request(command) {const job=this.queue.then(()=>this.rules.request(command));this.queue=job.catch(()=>{});return job;}
  rawRequest(command) {
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(() => this.fail(new Error('Движок не ответил вовремя. Перезагрузите страницу.')), 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, command });
    });
  }
}
