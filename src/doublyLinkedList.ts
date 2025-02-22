class Node {
  next: Node | null;
  prev: Node | null;
  value: any;
  key: string;
  constructor (value: any, next: Node | null, key: any){
    this.next = next;
    this.prev = null;
    this.value = value;
    this.key = key; // added this to delete the value from the cache
  }
}

export class DoublyLinkedList {
  head: any;
  tail: any;
  constructor () {
    this.head = null;
    this.tail = null;
  }

  addHead (value: any, key: any) {
    this.head = new Node(value, this.head, key);
  
    if (!this.tail) this.tail = this.head;
    else this.head.next.prev = this.head;
    
    return this.head;
  }

  deleteTail () {
    const deleted = this.tail; // what if head is null? it returns null?
    if (this.head === this.tail) this.head = this.tail = null;
    else {
      this.tail = this.tail.prev
      this.tail.next = null;
    }
    return deleted;
  }

  deleteHead () {
    const deleted = this.head; // what if head is null? it returns null?
    if (this.head === this.tail) this.head = this.tail = null;
    else {
      this.head = this.head.next
      this.head.prev = null;
    }
    return deleted;
  }

  printList() {
    let current = this.tail;
    while(current) {
      console.log(current.key + ': ' + current.value)
      current = current.prev;
    }
  }
}