import { TaskStatus } from './DownloadTask';

export class DownloadQueue {
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this.runningTasks = new Map();
    this.pendingTasks = [];
    this.completedTasks = new Map();
    this.failedTasks = new Map();
    
    this.onTaskStart = null;
    this.onTaskProgress = null;
    this.onTaskComplete = null;
    this.onTaskFail = null;
    this.onQueueChange = null;
  }

  addTask(task) {
    task.onProgress = (t) => {
      if (this.onTaskProgress) {
        this.onTaskProgress(t);
      }
    };
    
    task.onComplete = (t) => {
      this.handleTaskComplete(t);
    };
    
    task.onError = (t, error) => {
      this.handleTaskFail(t, error);
    };
    
    this.pendingTasks.push(task);
    this.notifyQueueChange();
    this.processNext();
  }

  removeTask(taskId) {
    const pendingIndex = this.pendingTasks.findIndex(t => t.id === taskId);
    if (pendingIndex !== -1) {
      this.pendingTasks.splice(pendingIndex, 1);
      this.notifyQueueChange();
      return true;
    }
    
    if (this.runningTasks.has(taskId)) {
      const task = this.runningTasks.get(taskId);
      task.cancel();
      this.runningTasks.delete(taskId);
      this.notifyQueueChange();
      return true;
    }
    
    return false;
  }

  pauseTask(taskId) {
    if (this.runningTasks.has(taskId)) {
      const task = this.runningTasks.get(taskId);
      task.pause();
      return true;
    }
    return false;
  }

  resumeTask(taskId) {
    const task = this.runningTasks.get(taskId) || 
                 this.pendingTasks.find(t => t.id === taskId);
    
    if (task && task.status === TaskStatus.PAUSED) {
      task.resume();
      this.processNext();
      return true;
    }
    return false;
  }

  async processNext() {
    console.log(`处理下载队列: 运行中=${this.runningTasks.size}, 待处理=${this.pendingTasks.length}, 最大并发=${this.maxConcurrent}`);
    
    while (this.runningTasks.size < this.maxConcurrent && this.pendingTasks.length > 0) {
      const task = this.pendingTasks.shift();
      
      if (task.status === TaskStatus.CANCELLED) {
        console.log(`任务${task.chapterTitle}已取消，跳过`);
        continue;
      }
      
      console.log(`开始下载任务: ${task.chapterTitle}`);
      this.runningTasks.set(task.id, task);
      task.start();
      
      if (this.onTaskStart) {
        this.onTaskStart(task);
      }
      
      this.notifyQueueChange();
    }
  }

  handleTaskComplete(task) {
    this.runningTasks.delete(task.id);
    this.completedTasks.set(task.id, task);
    
    if (this.onTaskComplete) {
      this.onTaskComplete(task);
    }
    
    this.notifyQueueChange();
    this.processNext();
  }

  handleTaskFail(task, error) {
    this.runningTasks.delete(task.id);
    this.failedTasks.set(task.id, task);
    
    if (this.onTaskFail) {
      this.onTaskFail(task, error);
    }
    
    this.notifyQueueChange();
    this.processNext();
  }

  retryTask(taskId) {
    const failedTask = this.failedTasks.get(taskId);
    if (failedTask) {
      failedTask.status = TaskStatus.PENDING;
      failedTask.error = null;
      failedTask.downloadedImages = 0;
      failedTask.failedImages = 0;
      failedTask.progress = 0;
      
      this.failedTasks.delete(taskId);
      this.pendingTasks.push(failedTask);
      this.notifyQueueChange();
      this.processNext();
      return true;
    }
    return false;
  }

  getQueueInfo() {
    return {
      maxConcurrent: this.maxConcurrent,
      running: this.runningTasks.size,
      pending: this.pendingTasks.length,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      total: this.runningTasks.size + this.pendingTasks.length + 
             this.completedTasks.size + this.failedTasks.size,
    };
  }

  getAllTasks() {
    return {
      running: Array.from(this.runningTasks.values()),
      pending: this.pendingTasks,
      completed: Array.from(this.completedTasks.values()),
      failed: Array.from(this.failedTasks.values()),
    };
  }

  clearCompleted() {
    this.completedTasks.clear();
    this.notifyQueueChange();
  }

  clearFailed() {
    this.failedTasks.clear();
    this.notifyQueueChange();
  }

  notifyQueueChange() {
    if (this.onQueueChange) {
      this.onQueueChange(this.getQueueInfo());
    }
  }
}
