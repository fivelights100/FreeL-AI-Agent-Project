export class ToolsExecutor {
  private ws: WebSocket | null = null;
  private pendingTasks: Map<string, (result: any) => void> = new Map();

  constructor() {
    this.connectWebSocket();
  }

  private connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.onopen = () => {
      console.log('[Agent] Connected to Freel-Desktop Executor');
    };

    this.ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (this.pendingTasks.has(response.taskId)) {
          const resolve = this.pendingTasks.get(response.taskId);
          resolve?.(response);
          this.pendingTasks.delete(response.taskId);
        }
      } catch (error) {
        console.error('[Agent] Failed to parse desktop response', error);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Agent] Disconnected from desktop. Reconnecting in 5s...');
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  public async executeTool(action: string, parameters: any): Promise<any> {
    // 1. null 및 연결 상태 확인
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return { status: 'error', error: 'Freel-Desktop is not connected.' };
    }

    return new Promise((resolve) => {
      const taskId = crypto.randomUUID();
      
      const timeoutId = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        resolve({ status: 'error', error: 'Task timeout (30s)' });
      }, 30000);

      this.pendingTasks.set(taskId, (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });

      // 2. 이 부분! this.ws 뒤에 느낌표(!)를 붙여 에러를 해결합니다.
      this.ws!.send(JSON.stringify({
        taskId,
        action,
        parameters
      }));
      
      console.log(`[Agent] Sent task [${action}] to desktop (ID: ${taskId})`);
    });
  }
}