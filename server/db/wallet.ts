import { eq, desc } from "drizzle-orm";
import { getDb } from "../db";
import { wallets, transactions, InsertWallet, InsertTransaction } from "../../drizzle/schema";

export async function getWalletByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  
  if (result.length === 0) {
    // Create wallet if not exists
    await db.insert(wallets).values({ userId, balance: "0.00" });
    const newWallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    return newWallet[0] || null;
  }
  
  return result[0];
}

export async function getTransactionsByUserId(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  // Get regular wallet transactions
  const walletTransactions = await db.select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
  
  // Get bank transfer requests
  const { bankTransferRequests } = await import("../../drizzle/schema");
  const bankTransfers = await db.select()
    .from(bankTransferRequests)
    .where(eq(bankTransferRequests.userId, userId))
    .orderBy(desc(bankTransferRequests.createdAt))
    .limit(limit);
  
  // Combine and format
  const combined = [
    ...walletTransactions.map((tx: any) => ({
      ...tx,
      source: 'wallet' as const,
    })),
    ...bankTransfers.map((bt: any) => ({
      id: bt.id,
      userId: bt.userId,
      type: 'bank_transfer' as const,
      amount: bt.requestedAmount,
      balanceAfter: '0', // Will be filled from wallet after approval
      description: `Bank Transfer (${bt.status})`,
      createdAt: bt.createdAt,
      source: 'bank_transfer' as const,
      status: bt.status,
      receiptImageUrl: bt.receiptImageUrl,
      requestedCurrency: bt.requestedCurrency,
    })),
  ];
  
  // Sort by date and limit
  return combined
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function deposit(userId: number, amount: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const wallet = await getWalletByUserId(userId);
  if (!wallet) throw new Error("Wallet not found");
  
  const currentBalance = parseFloat(wallet.balance as string);
  const depositAmount = parseFloat(amount);
  const currentCredit = parseFloat((wallet as any).creditBalance || '0');
  
  // Deduct outstanding debt from deposit first
  let actualDeposit = depositAmount;
  let debtDeducted = 0;
  let newCreditBalance = currentCredit;
  
  if (currentCredit > 0) {
    debtDeducted = Math.min(currentCredit, depositAmount);
    actualDeposit = depositAmount - debtDeducted;
    newCreditBalance = currentCredit - debtDeducted;
  }
  
  const newBalance = (currentBalance + actualDeposit).toFixed(2);
  
  // Update wallet balance and credit
  await db.update(wallets)
    .set({
      balance: newBalance,
      ...(currentCredit > 0 ? { creditBalance: newCreditBalance.toFixed(2) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(wallets.userId, userId));
  
  // Create transaction record
  await db.insert(transactions).values({
    walletId: wallet.id,
    userId,
    type: "deposit",
    amount,
    balanceBefore: wallet.balance as string,
    balanceAfter: newBalance,
    description: debtDeducted > 0
      ? `${description || 'Deposit'} (خصم مديونية $${debtDeducted.toFixed(2)})`
      : (description || "Deposit"),
    status: "completed",
  });
  
  return { success: true, newBalance, debtDeducted };
}

export async function withdraw(userId: number, amount: string, type: "withdrawal" | "card_purchase" | "subscription", description?: string, referenceType?: string, referenceId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const wallet = await getWalletByUserId(userId);
  if (!wallet) throw new Error("Wallet not found");
  
  const currentBalance = parseFloat(wallet.balance as string);
  const withdrawAmount = parseFloat(amount);
  
  if (currentBalance < withdrawAmount) {
    throw new Error("Insufficient balance");
  }
  
  const newBalance = (currentBalance - withdrawAmount).toFixed(2);
  
  // Update wallet balance
  await db.update(wallets)
    .set({ balance: newBalance })
    .where(eq(wallets.userId, userId));
  
  // Create transaction record
  await db.insert(transactions).values({
    walletId: wallet.id,
    userId,
    type,
    amount,
    balanceBefore: wallet.balance as string,
    balanceAfter: newBalance,
    description,
    referenceType,
    referenceId,
    status: "completed",
  });
  
  return { success: true, newBalance };
}

export async function getBalance(userId: number): Promise<string> {
  const wallet = await getWalletByUserId(userId);
  return wallet?.balance as string || "0.00";
}
