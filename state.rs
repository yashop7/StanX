use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub market_id: u32,
    pub settlement_deadline: i64,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub is_settled: bool,
    pub winning_outcome: Option<WinningOutcome>,
    pub total_collateral_locked: u64,
    pub bump: u8,
    #[max_len(200)]
    pub meta_data_url: String,
    pub outcome_yes_mint: Pubkey,
    pub outcome_no_mint: Pubkey,
    pub yes_escrow: Pubkey,
    pub no_escrow: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub user: Pubkey,
    pub market_id: u32,
    pub claimable_yes: u64,
    pub locked_yes: u64,
    pub claimable_no: u64,
    pub locked_no: u64,
    pub claimable_collateral: u64,
    pub locked_collateral: u64,
    pub reward_claimed: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub struct Order {
    pub id: u64,
    pub market_id: u32,
    pub user_key: Pubkey,
    pub side: OrderSide,
    pub token_type: TokenType,
    pub price: u64,
    pub quantity: u64,
    pub filledquantity: u64,
    pub timestamp: i64,
}

#[account]
pub struct OrderBook {
    pub market_id: u32,
    pub next_order_id: u64,
    pub yes_buy_orders: Vec<Order>,
    pub yes_sell_orders: Vec<Order>,
    pub no_buy_orders: Vec<Order>,
    pub no_sell_orders: Vec<Order>,
    pub bump: u8,
}

impl OrderBook {
    pub const BASE_SIZE: usize = 8 + 4 + 8 + 1 + 16;

    pub const ORDER_SIZE: usize = 78;

    pub fn space(orders_per_side: usize) -> usize {
        Self::BASE_SIZE + (orders_per_side * Self::ORDER_SIZE * 4) // 4 vectors
    }

    pub fn total_orders(&self) -> usize {
        self.yes_buy_orders.len()
            + self.yes_sell_orders.len()
            + self.no_buy_orders.len()
            + self.no_sell_orders.len()
    }

    pub fn current_space_needed(&self) -> usize {
        let max_per_side = self
            .yes_buy_orders
            .len()
            .max(self.yes_sell_orders.len())
            .max(self.no_buy_orders.len())
            .max(self.no_sell_orders.len());
        Self::space(max_per_side)
    }

    pub fn space_with_growth(&self, growth_batch: usize) -> usize {
        assert!(growth_batch > 0, "growth_batch must be greater than 0");
        let current_max = self
            .yes_buy_orders
            .len()
            .max(self.yes_sell_orders.len())
            .max(self.no_buy_orders.len())
            .max(self.no_sell_orders.len());
        let next_capacity = ((current_max / growth_batch) + 1) * growth_batch;
        Self::space(next_capacity)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum WinningOutcome {
    OutcomeA,
    OutcomeB,
    Neither,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum TokenType {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum OrderSide {
    Buy,
    Sell,
}
