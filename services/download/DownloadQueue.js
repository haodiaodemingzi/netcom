import { TaskStatus } from './BaseDownloadTask';

export class DownloadQueue {
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent;
    this.runningTasks = new Map();
    this.pendingTasks = [];
    this.pausedTasks = new Map();
    this.completedTasks = new Map();
    this.failedTasks = new Map();
    
    this.onTaskStart = null;
    this.onTaskProgress = null;
    this.onTaskComplete = null;
    this.onTaskFail = null;
    this.onQueueChange = null;
  }
  
  setMaxConcurrent(max) {
    this.maxConcurrent = max;
    console.log(`下载队列并发数已更新为: ${max}`);
    this.processNext();
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
      this.processNext();
      return true;
    }
    
    if (this.pausedTasks.has(taskId)) {
      this.pausedTasks.delete(taskId);
      this.notifyQueueChange();
      return true;
    }
    
    return false;
  }

  pauseTask(taskId) {
    const pendingIndex = this.pendingTasks.findIndex(t => t.id === taskId);
    if (pendingIndex !== -1) {
      const task = this.pendingTasks[pendingIndex];
      this.pendingTasks.splice(pendingIndex, 1);
      task.pause();
      this.pausedTasks.set(taskId, task);
      this.notifyQueueChange();
      return true;
    }

    if (this.runningTasks.has(taskId)) {
      const task = this.runningTasks.get(taskId);
      task.pause();
      this.runningTasks.delete(taskId);
      this.pausedTasks.set(taskId, task);
      this.notifyQueueChange();
      this.processNext(); // 处理下一个任务
      return true;
    }
    return false;
  }

  resumeTask(taskId) {
    if (this.pausedTasks.has(taskId)) {
      const task = this.pausedTasks.get(taskId);
      task.status = TaskStatus.PENDING;
      this.pausedTasks.delete(taskId);
      this.pendingTasks.unshift(task); // 添加到队列前面
      this.notifyQueueChange();
      this.processNext();
      return true;
    }
    return false;
  }

  async processNext() {
    console.log(`处理下载队列: 运行中=${this.runningTasks.size}, 待处理=${this.pendingTasks.length}, 暂停=${this.pausedTasks.size}, 最大并发=${this.maxConcurrent}`);
    
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
      paused: this.pausedTasks.size,
      completed: this.completedTasks.size,
      failed: this.failedTasks.size,
      total: this.runningTasks.size + this.pendingTasks.length + this.pausedTasks.size +
             this.completedTasks.size + this.failedTasks.size,
    };
  }

  getAllTasks() {
    return {
      running: Array.from(this.runningTasks.values()),
      pending: this.pendingTasks,
      paused: Array.from(this.pausedTasks.values()),
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
